import { db } from '../config/database.js';
import { ENV } from '../config/environment.js';

/**
 * SERVICIO 1: GATEWAY DE WHATSAPP
 * Responsabilidad:
 * 1. Recepción y autenticación de webhooks de Meta WhatsApp Cloud API.
 * 2. Ingesta a ultra-baja latencia (<50ms): persiste en Postgres y encola en pending_actions.
 * 3. Despacho de salida hacia la API oficial de WhatsApp.
 */
export const whatsappGateway = {
  /**
   * Procesa el webhook entrante de Meta
   */
  async handleIncomingWebhook(payload) {
    if (payload.object !== 'whatsapp_business_account') {
      return { status: 'IGNORED', reason: 'Not a WhatsApp business object' };
    }

    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    const contact = change?.contacts?.[0];

    if (!message) {
      return { status: 'IGNORED', reason: 'No message content (status update)' };
    }

    const clientPhone = message.from;
    const clientName = contact?.profile?.name || 'Cliente WhatsApp';
    const messageId = message.id;

    let textContent = '';
    if (message.type === 'text') {
      textContent = message.text?.body || '';
    } else if (message.type === 'interactive') {
      textContent = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
    } else {
      textContent = `[Mensaje de tipo ${message.type}]`;
    }

    // 1. Obtener o crear la conversación en Postgres
    const conversation = db.getOrCreateConversation(clientPhone, clientName);

    // 2. Persistir mensaje entrante del usuario en la tabla 'messages'
    const storedMsg = db.addMessage(conversation.id, 'user', textContent, null, {
      message_id: messageId,
      raw: message
    });

    // 3. Encolar la acción en Postgres para que el Worker la procese
    const queuedJob = db.enqueueAction(conversation.id, 'incoming_whatsapp_message', {
      phone: clientPhone,
      client_name: clientName,
      message_id: messageId,
      text: textContent,
      stored_msg_id: storedMsg.id
    });

    console.log(`[Gateway] 📥 Mensaje de ${clientName} (${clientPhone}) encolado en Postgres (Job ID: ${queuedJob.id})`);

    return {
      status: 'QUEUED',
      conversation_id: conversation.id,
      job_id: queuedJob.id
    };
  },

  /**
   * Despacho de mensajes hacia WhatsApp (Meta Cloud API o simulador)
   */
  async sendMessage(toPhone, text, metadata = {}) {
    console.log(`[Gateway] 📤 Despachando mensaje a ${toPhone}: "${text}"`);

    if (ENV.WHATSAPP_ACCESS_TOKEN && ENV.WHATSAPP_PHONE_NUMBER_ID) {
      try {
        const response = await fetch(`https://graph.facebook.com/v19.0/${ENV.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ENV.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: toPhone,
            type: 'text',
            text: { body: text }
          })
        });

        const data = await response.json();
        return { success: true, meta_response: data };
      } catch (err) {
        console.error(`[Gateway] ❌ Error enviando a Meta WhatsApp API:`, err);
        return { success: false, error: err.message };
      }
    }

    // Retorno en modo local/simulado
    return { success: true, simulated: true };
  }
};
