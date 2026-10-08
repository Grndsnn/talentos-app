import { db } from '../config/database.js';
import { barberService } from './barberService.js';
import { appointmentService } from './appointmentService.js';

export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'cita',
      description: 'Consultar disponibilidad o agendar/modificar una cita con un barbero específico.',
      parameters: {
        type: 'object',
        properties: {
          accion: {
            type: 'string',
            enum: ['consultar_disponibilidad', 'agendar_cita', 'cancelar_cita'],
            description: 'Acción a realizar'
          },
          barbero: {
            type: 'string',
            description: 'Nombre del barbero solicitado (ej. Toño, Memo, Carlos)'
          },
          fecha: {
            type: 'string',
            description: 'Fecha deseada en formato YYYY-MM-DD'
          },
          hora: {
            type: 'string',
            description: 'Hora deseada en formato HH:MM (ej. 09:30, 16:00)'
          },
          servicio: {
            type: 'string',
            description: 'Tipo de corte: "Corte Normal" ($22.000) o "Corte con Barba" ($27.000)'
          },
          client_name: {
            type: 'string',
            description: 'Nombre del cliente si lo indicó'
          }
        },
        required: ['accion']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'recado_al_dueno',
      description: 'Dejar un recado o solicitud comercial/administrativa al dueño de la barbería.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Resumen del asunto' },
          mensaje_cliente: { type: 'string', description: 'Detalle del recado' },
          urgente: { type: 'boolean', description: 'True si es urgente' }
        },
        required: ['motivo', 'mensaje_cliente']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'traspaso_urgente',
      description: 'Transferir la conversación a un humano por cliente inconforme, queja o emergencia.',
      parameters: {
        type: 'object',
        properties: {
          motivo_escalamiento: { type: 'string', description: 'Causa del traspaso' },
          prioridad: { type: 'string', enum: ['alta', 'critica'], description: 'Prioridad' }
        },
        required: ['motivo_escalamiento', 'prioridad']
      }
    }
  }
];

/**
 * Utilidades de extracción lingüística en español
 */
function extractClientName(text) {
  if (!text) return null;
  // Captura nombre completo (uno o más palabras), ej: "me llamo David García"
  const match = text.match(/(?:mi nombre es|me llamo|soy)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+)*)/i);
  if (!match) return null;
  return match[1]
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Verifica si el nombre almacenado en la conversación es uno de los placeholders por defecto
function isUnknownClient(conversation) {
  const placeholders = ['Cliente WhatsApp', 'Cliente Demo', 'Cliente', ''];
  return !conversation?.client_name || placeholders.includes(conversation.client_name.trim());
}

function extractRequestedTime(text) {
  if (!text) return null;
  const clean = text.toLowerCase();

  // Patrón: "9:30 am", "9:30", "a las 6:00", "a las 9", "18:00", "6pm"
  const match = clean.match(/(?:a las\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const modifier = match[3] ? match[3].toLowerCase().replace(/\./g, '') : null;

  if (modifier === 'pm' && hours < 12) {
    hours += 12;
  } else if (modifier === 'am' && hours === 12) {
    hours = 0;
  } else if (!modifier) {
    // Si no indica am/pm pero dice "6" o "6:00" en barbería (que abre 9 a 20), es 18:00 (6 PM)
    if (hours >= 1 && hours <= 7) {
      hours += 12; // 6 -> 18:00
    }
  }

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

function extractTargetDate(text) {
  const clean = (text || '').toLowerCase();
  const d = new Date();

  if (clean.includes('mañana') || clean.includes('manana')) {
    d.setDate(d.getDate() + 1);
  }

  return d.toISOString().slice(0, 10);
}

export const aiClassifier = {
  async classifyAndSelectTool(conversationId) {
    // 1. Obtener los últimos 12 mensajes de Postgres
    const recentMessages = db.getRecent12Messages(conversationId);
    const conversation = db.conversations.find(c => c.id === conversationId);

    const formattedMessages = recentMessages.map(m => ({
      role: m.role,
      content: m.content
    }));

    const lastUserMessage = recentMessages
      .slice()
      .reverse()
      .find(m => m.role === 'user')?.content || '';

    const lower = lastUserMessage.toLowerCase();

    // 2. Extraer si el usuario proporcionó su nombre (nombre completo)
    const extractedName = extractClientName(lastUserMessage);
    if (extractedName && conversation) {
      conversation.client_name = extractedName;
      conversation.updated_at = new Date().toISOString();
      conversation.metadata = conversation.metadata || {};
      conversation.metadata.name_confirmed = true;
      console.log(`[AI Classifier] 👤 Nombre del cliente identificado: "${extractedName}"`);
    }

    // Saber si el cliente es «desconocido» (sin nombre real confirmado)
    const clientIsUnknown = isUnknownClient(conversation) && !extractedName;

    // Verificar si es el PRIMER mensaje de la conversación (solo hay 1 mensaje del usuario)
    const userMsgsCount = recentMessages.filter(m => m.role === 'user').length;
    const isFirstMessage = userMsgsCount <= 1;

    // Detectar si el cliente es recurrente (tiene citas previas completadas)
    const clientRecord = db.clients.find(c => c.phone === conversation?.phone);
    const isReturningClient = clientRecord && clientRecord.total_visits > 0;
    const nameConfirmed = Boolean(conversation?.metadata?.name_confirmed) || isReturningClient;

    // 3. Ejecución OpenAI si la API Key está presente
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [
              {
                role: 'system',
                content: `Eres Sofía, la recepcionista virtual de BarberBot IA. NUNCA eres el barbero.
La barbería cuenta con 2 barberos oficiales:
1. Toño El Máster
2. Memo Barber

Nuestras tarifas y servicios son:
- Corte Normal / Clásico: $22.000 (22k)
- Corte con Barba: $27.000 (27k)
- Arreglo de Barba solo: $15.000 (15k)

Reglas:
- Si el cliente dice su nombre, salúdalo amablemente por su nombre.
- Siempre confirma qué tipo de corte desea (Corte Normal $22.000 o Corte con Barba $27.000) y su valor correspondiente.
- Si un barbero no tiene cupo a la hora solicitada, ofrece al otro barbero disponible a esa misma hora.
- Clasifica la intención y elige la herramienta adecuada.`
              },
              ...formattedMessages
            ],
            tools: AI_TOOLS,
            tool_choice: 'auto'
          })
        });

        const data = await response.json();
        const choice = data.choices?.[0]?.message;
        if (choice) {
          return {
            content: choice.content || '',
            tool_calls: choice.tool_calls || null,
            model_used: 'gpt-5-mini'
          };
        }
      } catch (err) {
        console.warn(`[AI Classifier] Fallback tras error en API gpt-5-mini: ${err.message}`);
      }
    }

    // 4. Motor Heurístico Determinista Avanzado

    // CASO 0: PRIMER MENSAJE sin nombre conocido → saludo + pedir nombre
    if (isFirstMessage && clientIsUnknown) {
      const greetingTime = new Date().getHours();
      const saludo = greetingTime < 12 ? '¡Buenos días!' : greetingTime < 19 ? '¡Buenas tardes!' : '¡Buenas noches!';
      return {
        content: `${saludo} Bienvenido a *BarberBot IA* 💈 — La recepcionista virtual de tu barbería de confianza.\n\nSoy *Sofía* y estaré encantada de ayudarte a agendar tu cita.\n\n¿Me podrías indicar tu *nombre completo*, por favor? Así te puedo atender personalmente. 😊`,
        tool_calls: null,
        model_used: 'gpt-5-mini'
      };
    }

    // CASO 0B: Nombre recibido → saludar, clasificar si es nuevo o recurrente
    if (extractedName && isFirstMessage) {
      if (isReturningClient) {
        const visits = clientRecord.total_visits;
        return {
          content: `¡Qué gusto verte de nuevo, *${extractedName}*! 🙌 ${visits > 1 ? `Ya llevas *${visits} visitas* con nosotros, ¡eres parte de la familia!` : 'Es un placer tenerte de regreso.'}\n\nContamos con *Toño El Máster* y *Memo Barber* disponibles.\n✂️ Corte Normal: $22.000 | Con Barba: $27.000\n\n¿Para qué hora y con quién te gustaría tu cita?`,
          tool_calls: null,
          model_used: 'gpt-5-mini'
        };
      } else {
        return {
          content: `¡Mucho gusto, *${extractedName}*! Bienvenido 😊 Es un placer saludarte.\n\nTenemos disponibles a nuestros 2 barberos:\n• *Toño El Máster*\n• *Memo Barber*\n\n💵 Nuestras tarifas:\n• *Corte Normal*: $22.000\n• *Corte con Barba*: $27.000\n• *Arreglo de Barba solo*: $15.000\n\n¿A qué hora y con cuál de los dos te gustaría agendar?`,
          tool_calls: null,
          model_used: 'gpt-5-mini'
        };
      }
    }

    // Caso A: Traspaso urgente / queja
    if (lower.includes('humano') || lower.includes('persona') || lower.includes('queja') || lower.includes('molesto') || lower.includes('urgente')) {
      return {
        content: 'Entiendo. Te estoy transfiriendo con nuestro equipo humano de inmediato.',
        tool_calls: [
          {
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: 'traspaso_urgente',
              arguments: JSON.stringify({
                motivo_escalamiento: 'Solicitud de atención humana',
                prioridad: 'alta'
              })
            }
          }
        ],
        model_used: 'gpt-5-mini'
      };
    }

    // Caso B: Recado al dueño
    if (lower.includes('dueño') || lower.includes('dueno') || lower.includes('administrador') || lower.includes('cotización') || lower.includes('mayorista') || lower.includes('proveedor')) {
      return {
        content: 'He tomado nota de tu recado para el dueño de la barbería.',
        tool_calls: [
          {
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: 'recado_al_dueno',
              arguments: JSON.stringify({
                motivo: 'Mensaje para el propietario',
                mensaje_cliente: lastUserMessage,
                urgente: lower.includes('urgente')
              })
            }
          }
        ],
        model_used: 'gpt-5-mini'
      };
    }

    // Caso C: Consulta de Precios / Tarifas
    if (lower.includes('precio') || lower.includes('costo') || lower.includes('tarifa') || lower.includes('cuanto vale') || lower.includes('cuánto vale') || lower.includes('cuanto cuesta') || lower.includes('cuánto cuesta') || lower.includes('valor')) {
      const nombreDisplay = (!clientIsUnknown && conversation?.client_name) ? `${conversation.client_name}, ` : '';
      return {
        content: `¡Hola ${nombreDisplay}te comparto nuestras tarifas! 💈\n\n✂️ *Corte Normal*: $22.000\n✂️ *Corte con Barba*: $27.000\n🧔 *Arreglo de Barba solo*: $15.000\n\nContamos con 2 barberos: *Toño El Máster* y *Memo Barber*. ¿Qué servicio deseas agendar y a qué hora?`,
        tool_calls: null,
        model_used: 'gpt-5-mini'
      };
    }

    // Caso D: Usuario se presenta en medio de la conversación (no primer mensaje)
    if (extractedName && !isFirstMessage && !lower.includes('agendar') && !lower.includes(':') && !lower.includes('hora')) {
      const greeting = isReturningClient
        ? `¡Qué gusto tenerte de nuevo, *${extractedName}*! 🙌 Ya te tenemos en nuestros registros con *${clientRecord.total_visits} visitas*.`
        : `¡Mucho gusto, *${extractedName}*! Soy Sofía, tu recepcionista virtual. 😊`;
      return {
        content: `${greeting}\n\n¿En qué te puedo ayudar? Puedo agendarte una cita con *Toño El Máster* o *Memo Barber*.\n• *Corte Normal*: $22.000\n• *Corte con Barba*: $27.000`,
        tool_calls: null,
        model_used: 'gpt-5-mini'
      };
    }

    // Caso D2: El usuario está indicando o confirmando el tipo de corte (ej. "solo corte, sin barba", "con barba", "opcion 1", "corte normal")
    const isSpecifyingCut = (
      lower.includes('solo corte') ||
      lower.includes('sin barba') ||
      lower.includes('con barba') ||
      lower.includes('corte normal') ||
      lower.includes('corte clásico') ||
      lower.includes('corte clasico') ||
      lower.includes('solo la barba') ||
      lower.includes('solo barba') ||
      lower.includes('corte y barba') ||
      lower.includes('corte con barba') ||
      lower.includes('22k') ||
      lower.includes('22000') ||
      lower.includes('22.000') ||
      lower.includes('27k') ||
      lower.includes('27000') ||
      lower.includes('27.000') ||
      lower === '1' ||
      lower === '2' ||
      lower === 'corte' ||
      lower.includes('opcion 1') ||
      lower.includes('opción 1') ||
      lower.includes('opcion 2') ||
      lower.includes('opción 2')
    );

    const hasBeardMention = (
      lower.includes('con barba') ||
      lower.includes('y barba') ||
      lower.includes('corte y barba') ||
      lower.includes('corte con barba') ||
      lower === '2' ||
      lower.includes('opcion 2') ||
      lower.includes('opción 2') ||
      lower.includes('27k') ||
      lower.includes('27.000') ||
      lower.includes('27000') ||
      (lower.includes('barba') && !lower.includes('sin barba'))
    );

    const detectedService = hasBeardMention ? 'Corte con Barba' : 'Corte Normal';

    const pendingBooking = conversation?.metadata?.pending_booking;
    const existingAppointment = db.appointments
      .filter(a => a.client_phone === conversation?.phone && a.status === 'confirmed')
      .slice(-1)[0];

    if (isSpecifyingCut && (pendingBooking || existingAppointment)) {
      const targetBarber = pendingBooking?.barber_name || 
        (existingAppointment ? barberService.getBarberById(existingAppointment.barber_id)?.name : null) || 
        'Toño';
      
      const targetDate = pendingBooking?.fecha || 
        (existingAppointment ? existingAppointment.datetime.slice(0, 10) : new Date().toISOString().slice(0, 10));

      const targetTime = pendingBooking?.hora || 
        (existingAppointment ? new Date(existingAppointment.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '10:00');

      return {
        content: `Confirmando tipo de corte: ${detectedService}...`,
        tool_calls: [
          {
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: 'cita',
              arguments: JSON.stringify({
                accion: 'agendar_cita',
                barbero: targetBarber,
                fecha: targetDate,
                hora: targetTime,
                servicio: detectedService,
                client_name: conversation?.client_name || extractedName || 'Cliente',
                cut_confirmed_by_user: true
              })
            }
          }
        ],
        model_used: 'gpt-5-mini'
      };
    }

    // Caso E: Agendamiento o consulta de horario
    // Detectar barbero del mensaje o buscar en el historial de los últimos mensajes
    let barberoName = null;
    if (lower.includes('memo')) barberoName = 'Memo';
    else if (lower.includes('carlos')) barberoName = 'Carlos';
    else if (lower.includes('toño') || lower.includes('tono')) barberoName = 'Toño';
    else {
      // Buscar si en los mensajes anteriores se mencionó a Toño o Memo
      const prevMention = recentMessages.find(m => m.content && (m.content.includes('Toño') || m.content.includes('Memo') || m.content.includes('Carlos')));
      if (prevMention) {
        if (prevMention.content.includes('Memo')) barberoName = 'Memo';
        else if (prevMention.content.includes('Carlos')) barberoName = 'Carlos';
        else barberoName = 'Toño';
      } else {
        barberoName = 'Toño';
      }
    }

    const requestedTime = extractRequestedTime(lastUserMessage);
    const requestedDate = extractTargetDate(lastUserMessage);

    // Si el usuario especificó una hora concreta (ej. "a las 9:30 am", "a las 6:00", "9:30") -> ACCIÓN: agendar_cita
    const isExplicitTime = Boolean(requestedTime);
    const isAgendar = isExplicitTime || lower.includes('confirmo') || lower.includes('agendar') || lower.includes('reserva') || lower.includes('apártame') || lower.includes('apartame');

    const hasExplicitCutChoice = (
      lower.includes('con barba') ||
      lower.includes('sin barba') ||
      lower.includes('solo corte') ||
      lower.includes('corte normal') ||
      lower.includes('corte con barba') ||
      lower.includes('corte y barba') ||
      lower.includes('solo barba')
    );

    return {
      content: isAgendar 
        ? `Gestionando tu cita con ${barberoName}...` 
        : `Consultando disponibilidad de ${barberoName}...`,
      tool_calls: [
        {
          id: `call_${Date.now()}`,
          type: 'function',
          function: {
            name: 'cita',
            arguments: JSON.stringify({
              accion: (isExplicitTime || isAgendar) ? 'agendar_cita' : 'consultar_disponibilidad',
              barbero: barberoName,
              fecha: requestedDate,
              hora: requestedTime || '10:00',
              servicio: detectedService,
              client_name: conversation?.client_name || extractedName || 'Cliente',
              cut_confirmed_by_user: hasExplicitCutChoice
            })
          }
        }
      ],
      model_used: 'gpt-5-mini'
    };
  }
};
