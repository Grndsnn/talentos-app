import { db } from '../config/database.js';
import { barberService } from './barberService.js';
import crypto from 'crypto';

export const appointmentService = {
  getAppointments({ date, barberId, status }) {
    let list = [...db.appointments];

    if (barberId) {
      list = list.filter(a => a.barber_id === barberId);
    }

    if (status) {
      list = list.filter(a => a.status === status);
    }

    if (date) {
      const targetDate = new Date(date).toISOString().slice(0, 10);
      list = list.filter(a => a.datetime.slice(0, 10) === targetDate);
    }

    // Ordenar cronológicamente
    return list.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  },

  checkAvailability(barberId, startIso, durationMinutes = 35, excludeAppointmentId = null) {
    const barber = barberService.getBarberById(barberId);
    if (!barber) {
      return { available: false, reason: 'Barbero no encontrado.' };
    }

    const startTime = new Date(startIso);
    if (isNaN(startTime.getTime())) {
      return { available: false, reason: 'Fecha y hora inválidas.' };
    }

    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    // 1. Verificar horario laboral
    const shiftCheck = barberService.isWithinWorkingHours(barber, startTime, durationMinutes);
    if (!shiftCheck.ok) {
      return { available: false, reason: shiftCheck.reason };
    }

    // 2. Verificar solapamiento con citas existentes
    const activeStatuses = ['confirmed', 'pending', 'blocked'];
    const collision = db.appointments.find(apt => {
      if (apt.barber_id !== barberId) return false;
      if (!activeStatuses.includes(apt.status)) return false;
      if (excludeAppointmentId && apt.id === excludeAppointmentId) return false;

      const aptStart = new Date(apt.datetime);
      const aptEnd = new Date(apt.end_datetime);

      // Choque de intervalos: (start < aptEnd) && (end > aptStart)
      return (startTime < aptEnd && endTime > aptStart);
    });

    if (collision) {
      return {
        available: false,
        reason: `El barbero ya tiene una cita asignada en ese rango (${new Date(collision.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(collision.end_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}).`
      };
    }

    return { available: true };
  },

  checkCrossBarberAvailability(barberId, startIso, durationMinutes = 35) {
    const primaryCheck = this.checkAvailability(barberId, startIso, durationMinutes);
    const otherBarber = barberService.getOtherBarber(barberId);
    let otherCheck = null;

    if (otherBarber) {
      otherCheck = this.checkAvailability(otherBarber.id, startIso, durationMinutes);
    }

    return {
      primaryAvailable: primaryCheck.available,
      primaryReason: primaryCheck.reason,
      otherBarber,
      otherAvailable: otherCheck ? otherCheck.available : false,
      otherReason: otherCheck ? otherCheck.reason : null
    };
  },

  getAvailableSlots(barberId, dateString, durationMinutes = 35) {
    const barber = barberService.getBarberById(barberId);
    if (!barber) return [];

    let baseDate;
    if (typeof dateString === 'string' && dateString.includes('-')) {
      const [y, m, d] = dateString.slice(0, 10).split('-').map(Number);
      baseDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    } else if (dateString instanceof Date) {
      baseDate = new Date(dateString.getFullYear(), dateString.getMonth(), dateString.getDate(), 0, 0, 0, 0);
    } else {
      const now = new Date();
      baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    }

    if (isNaN(baseDate.getTime())) return [];

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = days[baseDate.getDay()];
    const schedule = barber.working_hours[dayKey];

    if (!schedule || !schedule.active) return [];

    const [startH, startM] = schedule.start.split(':').map(Number);
    const [endH, endM] = schedule.end.split(':').map(Number);

    const shiftStart = new Date(baseDate);
    shiftStart.setHours(startH, startM, 0, 0);

    const shiftEnd = new Date(baseDate);
    shiftEnd.setHours(endH, endM, 0, 0);

    const stepMinutes = 30; // Saltos de 30 minutos
    const slots = [];

    let current = new Date(shiftStart);

    while (current.getTime() + durationMinutes * 60000 <= shiftEnd.getTime()) {
      const check = this.checkAvailability(barberId, current.toISOString(), durationMinutes);
      if (check.available) {
        slots.push({
          time: current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
          datetime_iso: current.toISOString()
        });
      }
      current = new Date(current.getTime() + stepMinutes * 60000);
    }

    return slots;
  },

  createAppointment({
    barber_id,
    service_id,
    client_name,
    client_phone,
    datetime,
    duration_minutes = 35,
    payment_method = 'pending',
    notes = '',
    source = 'whatsapp'
  }) {
    // 1. Validar disponibilidad
    const avail = this.checkAvailability(barber_id, datetime, duration_minutes);
    if (!avail.available) {
      throw new Error(avail.reason);
    }

    const barber = barberService.getBarberById(barber_id);
    const service = db.services.find(s => s.id === service_id);

    const startTime = new Date(datetime);
    const endTime = new Date(startTime.getTime() + duration_minutes * 60000);
    const totalAmount = service ? Number(service.price) : 22000;
    const commissionRate = barber ? barber.commission_rate : 0.40;
    const commissionAmount = Math.round(totalAmount * commissionRate);

    // 2. Gestionar o sincronizar cliente
    let client = db.clients.find(c => c.phone === client_phone);
    if (!client) {
      client = {
        id: crypto.randomUUID(),
        phone: client_phone,
        name: client_name,
        total_visits: 0,
        tags: ['nuevo', source],
        notes: ''
      };
      db.clients.push(client);
    }

    const newAppointment = {
      id: `apt-${Date.now().toString().slice(-6)}`,
      barber_id,
      service_id,
      client_id: client.id,
      client_name,
      client_phone,
      datetime: startTime.toISOString(),
      end_datetime: endTime.toISOString(),
      status: 'confirmed',
      payment_method,
      total_amount: totalAmount,
      commission_amount: commissionAmount,
      notes,
      reminder_24h_sent: false,
      reminder_2h_sent: false,
      source,
      created_at: new Date().toISOString()
    };

    db.appointments.push(newAppointment);
    return newAppointment;
  },

  updateAppointmentStatus(id, { status, payment_method, notes }) {
    const apt = db.appointments.find(a => a.id === id);
    if (!apt) {
      throw new Error('Cita no encontrada.');
    }

    if (status) apt.status = status;
    if (payment_method) apt.payment_method = payment_method;
    if (notes !== undefined) apt.notes = notes;

    // Si pasa a completada, incrementar fidelización
    if (status === 'completed' && apt.client_id) {
      const client = db.clients.find(c => c.id === apt.client_id);
      if (client) {
        client.total_visits = (client.total_visits || 0) + 1;
        client.last_visit = new Date().toISOString();
        if (client.total_visits >= 5 && !client.tags.includes('vip')) {
          client.tags.push('vip');
        } else if (client.total_visits >= 2 && !client.tags.includes('frecuente')) {
          client.tags.push('frecuente');
        }
      }
    }

    return apt;
  },

  getPendingReminders() {
    const now = new Date();
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const for24h = db.appointments.filter(a => {
      const aptTime = new Date(a.datetime);
      return (
        ['confirmed', 'pending'].includes(a.status) &&
        !a.reminder_24h_sent &&
        aptTime > now &&
        aptTime <= in24Hours
      );
    });

    const for2h = db.appointments.filter(a => {
      const aptTime = new Date(a.datetime);
      return (
        ['confirmed', 'pending'].includes(a.status) &&
        !a.reminder_2h_sent &&
        aptTime > now &&
        aptTime <= in2Hours
      );
    });

    return { for24h, for2h };
  }
};
