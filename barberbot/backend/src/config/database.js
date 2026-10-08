import { ENV } from './environment.js';

class DatabaseManager {
  constructor() {
    this.useSupabase = Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY && ENV.SUPABASE_ANON_KEY !== 'tu_supabase_anon_key_aqui');

    // Tablas existentes
    this.barbers = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Toño El Máster',
        phone: '+573001234567',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        commission_rate: 0.45,
        is_active: true,
        working_hours: {
          monday: { start: '09:00', end: '19:00', active: true },
          tuesday: { start: '09:00', end: '19:00', active: true },
          wednesday: { start: '09:00', end: '19:00', active: true },
          thursday: { start: '09:00', end: '19:00', active: true },
          friday: { start: '09:00', end: '20:00', active: true },
          saturday: { start: '09:00', end: '20:00', active: true },
          sunday: { start: '10:00', end: '15:00', active: false }
        }
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Memo Barber',
        phone: '+573007654321',
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        commission_rate: 0.40,
        is_active: true,
        working_hours: {
          monday: { start: '10:00', end: '20:00', active: true },
          tuesday: { start: '10:00', end: '20:00', active: true },
          wednesday: { start: '10:00', end: '20:00', active: true },
          thursday: { start: '10:00', end: '20:00', active: true },
          friday: { start: '10:00', end: '21:00', active: true },
          saturday: { start: '09:00', end: '21:00', active: true },
          sunday: { start: '10:00', end: '15:00', active: false }
        }
      }
    ];

    this.services = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Corte Normal / Clásico',
        description: 'Corte a tijera o máquina con lavado y peinado.',
        price: 22000,
        duration_minutes: 35,
        category: 'corte',
        is_active: true
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        name: 'Corte con Barba',
        description: 'Corte completo, diseño y perfilado de barba con toalla caliente.',
        price: 27000,
        duration_minutes: 45,
        category: 'combo',
        is_active: true
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        name: 'Perfilado de Barba',
        description: 'Toalla caliente, vapor ozono y navaja.',
        price: 15000,
        duration_minutes: 25,
        category: 'barba',
        is_active: true
      },
      {
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        name: 'Pomada / Cera Moldeadora (Producto)',
        description: 'Fijación mate premium.',
        price: 28000,
        duration_minutes: 5,
        category: 'producto',
        is_active: true
      }
    ];

    this.clients = [
      {
        id: '99999991-9999-9999-9999-999999999991',
        phone: '+573105551122',
        name: 'Andrés Felipe Gómez',
        total_visits: 6,
        tags: ['vip', 'fade-medio'],
        notes: 'Cliente regular de Toño.'
      }
    ];

    const today = new Date();
    const getTodayAt = (hours, minutes = 0) => {
      const d = new Date(today);
      d.setHours(hours, minutes, 0, 0);
      return d.toISOString();
    };

    this.appointments = [
      {
        id: 'apt-001',
        barber_id: '11111111-1111-1111-1111-111111111111',
        service_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        client_name: 'Andrés Felipe Gómez',
        client_phone: '+573105551122',
        datetime: getTodayAt(10, 0),
        end_datetime: getTodayAt(10, 50),
        status: 'completed',
        payment_method: 'card',
        total_amount: 27000,
        commission_amount: 12150,
        notes: 'Atendido por Toño, pagó con tarjeta.',
        reminder_24h_sent: true,
        reminder_2h_sent: true,
        source: 'whatsapp'
      }
    ];

    // --- NUEVAS TABLAS PARA ESTADO EN POSTGRES ---
    // 1. Conversaciones (phone, status: active | blocked | bot_paused | suspended)
    //    Se inicia vacío para que cada sesión de prueba empiece con el flujo correcto.
    //    Los datos de demo son solo en `this.clients` para referencia de visitas previas.
    this.conversations = [];

    // 2. Mensajes persistidos (historial completo)
    this.messages = [];

    this._msgSeq = 100;
    this.pending_actions = [];
  }

  // Helper: Obtener o crear conversación por teléfono
  getOrCreateConversation(phone, clientName = 'Cliente WhatsApp') {
    let conv = this.conversations.find(c => c.phone === phone);
    if (!conv) {
      conv = {
        id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        phone,
        client_name: clientName,
        status: 'active', // active | blocked | bot_paused | suspended
        unread_count: 0,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.conversations.push(conv);
    } else if (clientName && clientName !== 'Cliente WhatsApp' && conv.client_name === 'Cliente WhatsApp') {
      conv.client_name = clientName;
      conv.updated_at = new Date().toISOString();
    }
    return conv;
  }

  // Helper: Guardar mensaje en Postgres
  addMessage(conversationId, role, content, toolCalls = null, rawPayload = null) {
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      conversation_id: conversationId,
      seq: ++this._msgSeq,
      role,
      content,
      tool_calls: toolCalls,
      raw_payload: rawPayload,
      created_at: new Date().toISOString()
    };
    this.messages.push(msg);

    const conv = this.conversations.find(c => c.id === conversationId);
    if (conv) {
      conv.updated_at = new Date().toISOString();
    }
    return msg;
  }

  // Helper: Obtener exactamente los últimos 12 mensajes ordenados cronológicamente
  getRecent12Messages(conversationId) {
    const msgs = this.messages
      .filter(m => m.conversation_id === conversationId)
      .sort((a, b) => {
        const timeDiff = new Date(b.created_at) - new Date(a.created_at);
        return timeDiff !== 0 ? timeDiff : (b.seq - a.seq);
      }) // más recientes primero
      .slice(0, 12) // solo los últimos 12
      .reverse(); // cronológico para el modelo

    return msgs;
  }

  // Helper: Encolar acción pendiente en Postgres
  enqueueAction(conversationId, jobType, payload) {
    const action = {
      id: `action-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      conversation_id: conversationId,
      job_type: jobType,
      payload,
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
      locked_at: null,
      locked_by: null,
      error_message: null,
      processed_at: null,
      created_at: new Date().toISOString()
    };
    this.pending_actions.push(action);
    return action;
  }

  // Dequeue con bloqueo de 1 turno por conversación
  // Garantiza: si la conversación ya tiene un job 'processing', no toma otro de esa misma conversación
  dequeueNextAction(workerId) {
    const pendingJobs = this.pending_actions.filter(a => a.status === 'pending');
    if (pendingJobs.length === 0) return null;

    // Obtener IDs de conversaciones que tienen trabajos activos ('processing')
    const busyConversationIds = new Set(
      this.pending_actions
        .filter(a => a.status === 'processing')
        .map(a => a.conversation_id)
    );

    // Encontrar el primer job cuya conversación NO esté ocupada
    const job = pendingJobs.find(a => !busyConversationIds.has(a.conversation_id));
    if (!job) return null;

    job.status = 'processing';
    job.locked_at = new Date().toISOString();
    job.locked_by = workerId;
    job.attempts += 1;

    return job;
  }

  // Marcar acción completada o fallida
  finishAction(actionId, success, errorMessage = null) {
    const job = this.pending_actions.find(a => a.id === actionId);
    if (job) {
      job.status = success ? 'completed' : 'failed';
      job.error_message = errorMessage;
      job.processed_at = new Date().toISOString();
      job.locked_at = null;
    }
  }
}

export const db = new DatabaseManager();
