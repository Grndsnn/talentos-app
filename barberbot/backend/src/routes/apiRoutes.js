import { Router } from 'express';
import { appointmentController } from '../controllers/appointmentController.js';
import { webhookController } from '../controllers/webhookController.js';
import { financeController } from '../controllers/financeController.js';

const router = Router();

// --- 1. Rutas de Disponibilidad y Agenda ---
router.get('/availability/check', appointmentController.checkAvailability);
router.get('/availability/slots', appointmentController.getAvailableSlots);

// --- 2. Rutas de Citas (Appointments) ---
router.get('/appointments', appointmentController.getAppointments);
router.post('/appointments', appointmentController.createAppointment);
router.patch('/appointments/:id/status', appointmentController.updateStatus);

// --- 3. Catálogos y Entidades ---
router.get('/barbers', appointmentController.getBarbers);
router.get('/services', appointmentController.getServices);
router.get('/clients', appointmentController.getClients);

// --- 4. Recordatorios Anti-No-Show ---
router.get('/reminders/pending', appointmentController.getReminders);

// --- 5. Finanzas y Control de Caja ---
router.get('/finances/daily-summary', financeController.getDailySummary);

// --- 6. Servicio 1: Gateway de WhatsApp ---
router.get('/webhook/whatsapp', webhookController.verifyWebhook);
router.post('/webhook/whatsapp', webhookController.handleIncomingMessage);
router.post('/webhook/simulate-chat', webhookController.simulateCustomerChat);

// --- 7. Servicio 2: Estado de Cola en Postgres y Conversaciones ---
router.get('/conversations', webhookController.getConversations);
router.patch('/conversations/:id/status', webhookController.updateConversationStatus);
router.get('/conversations/:id/messages', webhookController.getConversationMessages);
router.get('/queue/status', webhookController.getQueueStatus);

export default router;
