import { db } from '../config/database.js';
import { aiClassifier } from './aiClassifier.js';
import { whatsappGateway } from './whatsappGateway.js';
import { appointmentService } from './appointmentService.js';
import { barberService } from './barberService.js';

/**
 * SERVICIO 2: WORKER CON COLAS EN POSTGRES
 * Características arquitectónicas:
 * 1. Un turno a la vez por conversación (bloqueo por conversation_id).
 * 2. Múltiples conversaciones procesadas en paralelo.
 * 3. Reglas SIN IA ANTES: Bloqueado, Bot apagado, Suspendido.
 * 4. Clasificación gpt-5-mini con ventana de los últimos 12 mensajes.
 * 5. Filtro DESPUÉS: Validación y saneamiento antes del envío.
 */
export class QueueWorker {
  constructor(workerId = 'worker-1') {
    this.workerId = workerId;
    this.isRunning = false;
    this.pollIntervalMs = 500;
  }

  start() {
    this.isRunning = true;
    console.log(`[Worker:${this.workerId}] 🚀 Iniciado y escuchando colas en Postgres...`);
    this.loop();
  }

  stop() {
    this.isRunning = false;
    console.log(`[Worker:${this.workerId}] 🛑 Detenido.`);
  }

  async loop() {
    while (this.isRunning) {
      try {
        await this.processNextJob();
      } catch (err) {
        console.error(`[Worker:${this.workerId}] 💥 Error en ciclo de cola:`, err);
      }
      await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  /**
   * Procesa el siguiente job disponible respetando la serialización por conversación
   */
  async processNextJob() {
    // 1. Dequeue atómico: garantiza 1 turno a la vez por conversación
    const job = db.dequeueNextAction(this.workerId);
    if (!job) return;

    const conversation = db.conversations.find(c => c.id === job.conversation_id);
    if (!conversation) {
      db.finishAction(job.id, false, 'Conversación no encontrada');
      return;
    }

    console.log(`[Worker:${this.workerId}] ⚙️ Procesando Job ${job.id} para conversación ${conversation.phone} (Estado: ${conversation.status})`);

    try {
      // =========================================================================
      // FASE 1: REGLAS SIN IA ANTES (Pre-filtro)
      // =========================================================================
      if (conversation.status === 'blocked') {
        console.log(`[Worker] 🚫 Contacto BLOQUEADO (${conversation.phone}). Se descarta procesamiento sin invocar IA.`);
        db.finishAction(job.id, true);
        return;
      }

      if (conversation.status === 'bot_paused') {
        console.log(`[Worker] ⏸️ BOT APAGADO para (${conversation.phone}). Mensaje registrado para atención humana directa.`);
        db.finishAction(job.id, true);
        return;
      }

      if (conversation.status === 'suspended') {
        console.log(`[Worker] ⚠️ Cuenta SUSPENDIDA (${conversation.phone}). Despachando mensaje administrativo sin IA.`);
        const aviso = 'Aviso: La recepción automática de citas se encuentra temporalmente suspendida.';
        db.addMessage(conversation.id, 'assistant', aviso);
        await whatsappGateway.sendMessage(conversation.phone, aviso);
        db.finishAction(job.id, true);
        return;
      }

      // =========================================================================
      // FASE 2: CLASIFICACIÓN CON gpt-5-mini (ÚLTIMOS 12 MENSAJES)
      // =========================================================================
      const aiResult = await aiClassifier.classifyAndSelectTool(conversation.id);

      // =========================================================================
      // FASE 3: FILTRO DESPUÉS (Post-filtro y Ejecución de Herramientas)
      // =========================================================================
      let finalResponseText = '';
      const toolCalls = aiResult.tool_calls || [];

      if (toolCalls.length > 0) {
        for (const tool of toolCalls) {
          const fnName = tool.function.name;
          let args = {};
          try {
            args = typeof tool.function.arguments === 'string' 
              ? JSON.parse(tool.function.arguments) 
              : tool.function.arguments;
          } catch (e) {
            args = {};
          }

          console.log(`[Worker] 🛠️ Herramienta elegida por gpt-5-mini: '${fnName}' con args:`, args);

          if (fnName === 'cita') {
            const barber = barberService.findBarberByName(args.barbero) || barberService.getAllBarbers()[0];
            const dateStr = args.fecha || new Date().toISOString().slice(0, 10);
            const timeStr = args.hora || '10:00';
            const [reqH, reqM] = timeStr.split(':').map(Number);

            let targetDateTime;
            if (dateStr && dateStr.includes('-')) {
              const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
              targetDateTime = new Date(y, m - 1, d, reqH, reqM, 0, 0);
            } else {
              targetDateTime = new Date();
              targetDateTime.setHours(reqH, reqM, 0, 0);
            }

            // Determinar servicio y tarifa solicitada
            const requestedServiceArg = (args.servicio || '').toLowerCase();
            const lastUserText = (job.payload?.text || '').toLowerCase();
            const isBeard = requestedServiceArg.includes('barba') || 
                            lastUserText.includes('con barba') || 
                            lastUserText.includes('y barba') ||
                            lastUserText.includes('corte y barba');

            const isOnlyBeard = !isBeard && (requestedServiceArg.includes('solo barba') || lastUserText.includes('solo barba'));

            let selectedService;
            if (isOnlyBeard) {
              selectedService = db.services.find(s => s.category === 'barba') || db.services[2];
            } else if (isBeard) {
              selectedService = db.services.find(s => s.category === 'combo') || db.services[1]; // Corte con Barba ($27.000)
            } else {
              selectedService = db.services.find(s => s.category === 'corte') || db.services[0]; // Corte Normal ($22.000)
            }

            const durationMinutes = selectedService.duration_minutes || (isBeard ? 45 : 35);
            const servicePriceFormatted = Number(selectedService.price).toLocaleString('es-CO');

            const timeFormatted = targetDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            const todayStr = new Date().toLocaleDateString('en-CA');
            const diaNombre = (dateStr === todayStr || dateStr === new Date().toISOString().slice(0, 10)) ? 'Hoy' : 'Mañana';

            // Comprobar si ya existe una cita confirmada para este cliente hoy (para actualización o aclaración de tipo de corte)
            const existingApt = db.appointments.find(a => 
              a.client_phone === conversation.phone && 
              a.status === 'confirmed' &&
              a.datetime.slice(0, 10) === targetDateTime.toISOString().slice(0, 10)
            );

            const crossCheck = appointmentService.checkCrossBarberAvailability(barber.id, targetDateTime.toISOString(), durationMinutes);
            const isAvailableForClient = crossCheck.primaryAvailable || (existingApt && existingApt.barber_id === barber.id);
            const altBarber = crossCheck.otherBarber;

            if (args.accion === 'agendar_cita') {
              if (isAvailableForClient) {
                // Verificar si el usuario ya especificó el corte o debemos pedírselo
                const isExplicitCutInText = lastUserText.includes('con barba') || 
                                           lastUserText.includes('sin barba') || 
                                           lastUserText.includes('solo corte') || 
                                           lastUserText.includes('corte normal') || 
                                           lastUserText.includes('corte con barba') ||
                                           lastUserText.includes('solo barba') ||
                                           lastUserText === '1' ||
                                           lastUserText === '2' ||
                                           lastUserText.includes('opcion 1') ||
                                           lastUserText.includes('opción 1') ||
                                           lastUserText.includes('opcion 2') ||
                                           lastUserText.includes('opción 2');

                const cutConfirmed = Boolean(args.cut_confirmed_by_user || isExplicitCutInText);

                if (!cutConfirmed) {
                  // Si no se le indicó el tipo de corte: PEDIR TIPO DE CORTE
                  conversation.metadata.pending_booking = {
                    barber_id: barber.id,
                    barber_name: barber.name,
                    fecha: dateStr,
                    hora: timeStr,
                    timeFormatted,
                    diaNombre
                  };
                  conversation.updated_at = new Date().toISOString();

                  finalResponseText = `¡Con gusto, ${conversation.client_name || 'amigo'}! Para apartar tu cita a las *${timeFormatted}* con *${barber.name}*, por favor confírmame qué tipo de corte deseas:\n\n✂️ *1. Corte Normal*: $22.000\n✂️ *2. Corte con Barba*: $27.000\n\n¿Cuál de los dos prefieres?`;
                } else {
                  // El usuario indicó o confirmó el tipo de corte
                  if (existingApt && existingApt.barber_id === barber.id) {
                    existingApt.service_id = selectedService.id;
                    existingApt.total_amount = Number(selectedService.price);
                    existingApt.commission_amount = Math.round(Number(selectedService.price) * (barber.commission_rate || 0.40));
                    existingApt.notes = `Servicio confirmado por cliente: ${selectedService.name}`;

                    if (conversation.metadata.pending_booking) {
                      delete conversation.metadata.pending_booking;
                    }

                    finalResponseText = `✂️ ¡Listo, ${conversation.client_name || 'amigo'}! Tu cita con *${barber.name}* a las *${timeFormatted}* quedó confirmada para *${selectedService.name}* por un valor de *$${servicePriceFormatted}*.\n\nTe enviaremos un recordatorio anti-faltas antes de la cita. ¡Te esperamos en la barbería! 💈`;
                  } else {
                    try {
                      const newApt = appointmentService.createAppointment({
                        barber_id: barber.id,
                        service_id: selectedService.id,
                        client_name: conversation.client_name || 'Cliente',
                        client_phone: conversation.phone,
                        datetime: targetDateTime.toISOString(),
                        duration_minutes: durationMinutes,
                        source: 'whatsapp'
                      });

                      if (conversation.metadata.pending_booking) {
                        delete conversation.metadata.pending_booking;
                      }

                      finalResponseText = `🎉 ¡Listo, ${conversation.client_name || 'amigo'}! Tu cita con *${barber.name}* quedó confirmada para ${diaNombre} a las *${timeFormatted}*.\n\n✂️ *Tipo de corte:* ${selectedService.name}\n💰 *Valor:* $${servicePriceFormatted}\n\nTe enviaremos un recordatorio anti-faltas antes de la cita. ¡Te esperamos en la barbería! 💈`;
                    } catch (createErr) {
                      finalResponseText = `Hubo un inconveniente al apartar con ${barber.name}: ${createErr.message}`;
                    }
                  }
                }
              } else {
                // EL BARBERO SOLICITADO NO TIENE ESPACIO A ESA HORA
                if (crossCheck.otherAvailable && altBarber) {
                  // ¡EL OTRO BARBERO SÍ TIENE ESPACIO A ESA HORA EXACTA!
                  finalResponseText = `El horario de las *${timeFormatted}* con *${barber.name}* ya está ocupado ❌.\n\n💈 Pero *${altBarber.name}* sí tiene espacio libre exactamente a las *${timeFormatted}*.\n\n¿Te gustaría que te agende con *${altBarber.name}* (${selectedService.name} - $${servicePriceFormatted}), o prefieres ver otros horarios de ${barber.name}?`;
                } else {
                  // NINGUNO TIENE A ESA HORA EXACTA -> OFRECER HUECOS CERCANOS DE AMBOS
                  const primarySlots = appointmentService.getAvailableSlots(barber.id, dateStr, durationMinutes).slice(0, 3).map(s => s.time).join(', ');
                  const altSlots = altBarber ? appointmentService.getAvailableSlots(altBarber.id, dateStr, durationMinutes).slice(0, 3).map(s => s.time).join(', ') : '';

                  finalResponseText = `A las *${timeFormatted}* ambos barberos tienen sus horarios ocupados.\n\n⏰ Horarios libres más cercanos disponibles:\n• *${barber.name}*: ${primarySlots || 'Sin cupos disponibles'}\n${altBarber ? `• *${altBarber.name}*: ${altSlots || 'Sin cupos disponibles'}\n` : ''}\n💵 *Tarifas:* Corte Normal: $22.000 | Con Barba: $27.000\n¿Cuál de estos horarios te queda mejor?`;
                }
              }
            } else {
              // CONSULTA GENERAL DE DISPONIBILIDAD
              const primarySlots = appointmentService.getAvailableSlots(barber.id, dateStr, durationMinutes).slice(0, 4).map(s => s.time).join(', ');
              const altSlots = altBarber ? appointmentService.getAvailableSlots(altBarber.id, dateStr, durationMinutes).slice(0, 4).map(s => s.time).join(', ') : '';

              finalResponseText = `Hola ${conversation.client_name || 'amigo'}, aquí tienes la disponibilidad de nuestros 2 barberos para hoy:\n\n✂️ *${barber.name}*: ${primarySlots || 'Agenda completa'}\n${altBarber ? `✂️ *${altBarber.name}*: ${altSlots || 'Agenda completa'}\n` : ''}\n💵 *Tarifas vigentes:*\n• Corte Normal: $22.000\n• Corte con Barba: $27.000\n• Perfilado de Barba solo: $15.000\n\n¿Con qué barbero y a qué hora prefieres apartar?`;
            }

          } else if (fnName === 'recado_al_dueno') {
            // Guardar el recado en la metadata de la conversación en Postgres
            if (!conversation.metadata.recados) conversation.metadata.recados = [];
            conversation.metadata.recados.push({
              motivo: args.motivo,
              mensaje: args.mensaje_cliente,
              urgente: args.urgente || false,
              fecha: new Date().toISOString()
            });

            finalResponseText = `📝 He dejado tu recado directamente al dueño de la barbería: *"${args.motivo}"*.\nSe pondrá en contacto contigo a la brevedad. ¡Gracias por escribirnos!`;

          } else if (fnName === 'traspaso_urgente') {
            // Traspaso inmediato: Pausar el bot para que intervenga el humano
            conversation.status = 'bot_paused';
            conversation.metadata.traspaso_urgente = {
              motivo: args.motivo_escalamiento,
              prioridad: args.prioridad,
              solicitado_en: new Date().toISOString()
            };

            finalResponseText = `⚠️ Entiendo la importancia. He transferido tu conversación con prioridad *${args.prioridad}* a nuestro equipo humano. En unos momentos un asesor continuará la atención.`;
          }
        }
      } else {
        // Respuesta conversacional directa filtrada
        finalResponseText = aiResult.content || '¡Hola! ¿En qué te puedo colaborar hoy en la barbería?';
      }

      // Filtro de seguridad post-procesamiento (Sanitización)
      finalResponseText = this.sanitizeOutput(finalResponseText);

      // 4. Guardar respuesta del asistente en la tabla 'messages'
      db.addMessage(conversation.id, 'assistant', finalResponseText, toolCalls);

      // 5. Enviar mensaje a través del Gateway de WhatsApp
      await whatsappGateway.sendMessage(conversation.phone, finalResponseText);

      // 6. Marcar trabajo completado en la cola de Postgres
      db.finishAction(job.id, true);
      console.log(`[Worker:${this.workerId}] ✅ Job ${job.id} finalizado y mensaje entregado.`);

    } catch (jobErr) {
      console.error(`[Worker:${this.workerId}] ❌ Error procesando Job ${job.id}:`, jobErr);
      db.finishAction(job.id, false, jobErr.message);
    }
  }

  /**
   * Filtro posterior de seguridad y saneamiento
   */
  sanitizeOutput(text) {
    if (!text) return '';
    // Eliminar posibles tokens internos o alucinaciones de formato
    return text
      .replace(/<\|.*?\|>/g, '')
      .replace(/\[SYSTEM_NOTE.*?\]/gi, '')
      .trim();
  }
}

export const workerInstance = new QueueWorker('worker-alpha');
