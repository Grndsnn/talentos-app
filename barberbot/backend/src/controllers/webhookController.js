import { ENV } from '../config/environment.js';
import { whatsappGateway } from '../services/whatsappGateway.js';
import { db } from '../config/database.js';
import { QueueWorker } from '../services/queueWorker.js';

export const webhookController = {
  /**
   * Verificación obligatoria de Meta Cloud API
   */
  verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === ENV.WHATSAPP_VERIFY_TOKEN) {
      console.log('✅ Webhook de WhatsApp verificado exitosamente por Meta.');
      return res.status(200).send(challenge);
    } else {
      console.warn('❌ Fallo de verificación de Webhook de WhatsApp. Token incorrecto.');
      return res.sendStatus(403);
    }
  },

  /**
   * Recepción del Gateway de WhatsApp: Ingesta ultra-rápida en Postgres y respuesta 200 en <50ms
   */
  async handleIncomingMessage(req, res) {
    try {
      // 1. Responder inmediatamente 200 OK a Meta
      res.status(200).json({ status: 'EVENT_RECEIVED' });

      // 2. Gateway desacoplado encola en Postgres
      await whatsappGateway.handleIncomingWebhook(req.body);
    } catch (error) {
      console.error('Error en Gateway de WhatsApp:', error);
    }
  },

  /**
   * Simulador interactivo: Encola en Postgres y procesa a través del Worker
   */
  async simulateCustomerChat(req, res) {
    try {
      const { message, client_name, client_phone } = req.body;

      if (!message) {
        return res.status(400).json({ success: false, error: 'Mensaje requerido.' });
      }

      const phone = client_phone || '+573105551122';
      const name = client_name || 'Cliente Demo';

      // 1. Gateway ingesta el mensaje y encola en Postgres
      const fakeWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ profile: { name } }],
                  messages: [
                    {
                      from: phone,
                      id: `wamid.test.${Date.now()}`,
                      type: 'text',
                      text: { body: message }
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      const result = await whatsappGateway.handleIncomingWebhook(fakeWebhookPayload);

      // 2. Ejecutar un ciclo del Worker inmediatamente para responder en la prueba sincrónica
      const testWorker = new QueueWorker('worker-sync-sim');
      await testWorker.processNextJob();

      // 3. Obtener la conversación actualizada y los últimos mensajes
      const conv = db.conversations.find(c => c.id === result.conversation_id);
      const recentMsgs = db.getRecent12Messages(result.conversation_id);
      const lastAssistantMsg = recentMsgs.slice().reverse().find(m => m.role === 'assistant');

      return res.json({
        success: true,
        conversation_status: conv ? conv.status : 'active',
        response: lastAssistantMsg ? lastAssistantMsg.content : 'Mensaje procesado en cola.',
        tool_calls: lastAssistantMsg ? lastAssistantMsg.tool_calls : null,
        total_messages: db.messages.filter(m => m.conversation_id === result.conversation_id).length,
        context_window_size: recentMsgs.length
      });

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Gestión de Conversaciones y Estados (Control del Bot)
   */
  getConversations(req, res) {
    return res.json({ success: true, data: db.conversations });
  },

  updateConversationStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body; // 'active', 'blocked', 'bot_paused', 'suspended'

    const conv = db.conversations.find(c => c.id === id || c.phone === id);
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversación no encontrada.' });
    }

    if (['active', 'blocked', 'bot_paused', 'suspended'].includes(status)) {
      conv.status = status;
      conv.updated_at = new Date().toISOString();
      return res.json({ success: true, message: `Estado actualizado a '${status}'`, data: conv });
    }

    return res.status(400).json({ success: false, error: 'Estado inválido. Opciones: active, blocked, bot_paused, suspended.' });
  },

  getConversationMessages(req, res) {
    const { id } = req.params;
    const allMessages = db.messages.filter(m => m.conversation_id === id);
    const window12 = db.getRecent12Messages(id);

    return res.json({
      success: true,
      total_in_db: allMessages.length,
      context_window_12: window12,
      all_messages: allMessages
    });
  },

  getQueueStatus(req, res) {
    const pending = db.pending_actions.filter(a => a.status === 'pending');
    const processing = db.pending_actions.filter(a => a.status === 'processing');
    const completed = db.pending_actions.filter(a => a.status === 'completed');
    const failed = db.pending_actions.filter(a => a.status === 'failed');

    return res.json({
      success: true,
      queue_summary: {
        total: db.pending_actions.length,
        pending: pending.length,
        processing: processing.length,
        completed: completed.length,
        failed: failed.length
      },
      jobs: db.pending_actions.slice(-20) // últimos 20
    });
  }
};
