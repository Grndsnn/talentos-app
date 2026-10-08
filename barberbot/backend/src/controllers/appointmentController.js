import { appointmentService } from '../services/appointmentService.js';
import { barberService } from '../services/barberService.js';
import { db } from '../config/database.js';
import { z } from 'zod';

const CreateAppointmentSchema = z.object({
  barber_id: z.string().min(1, 'El ID del barbero es requerido'),
  service_id: z.string().optional().nullable(),
  client_name: z.string().min(2, 'El nombre del cliente es obligatorio'),
  client_phone: z.string().min(7, 'El teléfono del cliente es obligatorio'),
  datetime: z.string().datetime({ message: 'Formato ISO de fecha/hora inválido' }),
  duration_minutes: z.number().int().positive().optional().default(35),
  payment_method: z.enum(['cash', 'card', 'transfer', 'pending']).optional().default('pending'),
  notes: z.string().optional().default(''),
  source: z.enum(['whatsapp', 'dashboard', 'manual']).optional().default('whatsapp')
});

export const appointmentController = {
  getAppointments(req, res) {
    try {
      const { date, barber_id, status } = req.query;
      const data = appointmentService.getAppointments({ date, barberId: barber_id, status });
      return res.json({ success: true, count: data.length, data });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  checkAvailability(req, res) {
    try {
      const { barber_id, datetime, duration } = req.query;
      if (!barber_id || !datetime) {
        return res.status(400).json({ 
          success: false, 
          error: 'Parámetros barber_id y datetime requeridos.' 
        });
      }

      const durationMinutes = duration ? parseInt(duration, 10) : 35;
      const result = appointmentService.checkAvailability(barber_id, datetime, durationMinutes);

      return res.json({ success: true, ...result });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  getAvailableSlots(req, res) {
    try {
      const { barber_id, date, duration } = req.query;
      if (!barber_id || !date) {
        return res.status(400).json({ 
          success: false, 
          error: 'Parámetros barber_id y date (YYYY-MM-DD) requeridos.' 
        });
      }

      const durationMinutes = duration ? parseInt(duration, 10) : 35;
      const slots = appointmentService.getAvailableSlots(barber_id, date, durationMinutes);

      return res.json({ 
        success: true, 
        barber_id, 
        date, 
        available_slots_count: slots.length, 
        slots 
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  createAppointment(req, res) {
    try {
      const validation = CreateAppointmentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          errors: validation.error.flatten().fieldErrors 
        });
      }

      const appointment = appointmentService.createAppointment(validation.data);
      return res.status(201).json({ 
        success: true, 
        message: 'Cita agendada exitosamente.', 
        data: appointment 
      });
    } catch (error) {
      return res.status(409).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, payment_method, notes } = req.body;

      const updated = appointmentService.updateAppointmentStatus(id, {
        status,
        payment_method,
        notes
      });

      return res.json({ 
        success: true, 
        message: 'Estado de cita actualizado.', 
        data: updated 
      });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  getReminders(req, res) {
    try {
      const reminders = appointmentService.getPendingReminders();
      return res.json({ success: true, data: reminders });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  getBarbers(req, res) {
    const barbers = barberService.getAllBarbers();
    return res.json({ success: true, data: barbers });
  },

  getServices(req, res) {
    const services = db.services.filter(s => s.is_active);
    return res.json({ success: true, data: services });
  },

  getClients(req, res) {
    return res.json({ success: true, data: db.clients });
  }
};
