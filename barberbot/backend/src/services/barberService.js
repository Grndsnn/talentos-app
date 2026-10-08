import { db } from '../config/database.js';

export const barberService = {
  getAllBarbers() {
    return db.barbers.filter(b => b.is_active);
  },

  getBarberById(id) {
    return db.barbers.find(b => b.id === id);
  },

  findBarberByName(name) {
    if (!name) return null;
    const clean = name.toLowerCase().trim();
    return db.barbers.find(b => b.name.toLowerCase().includes(clean)) || null;
  },

  isWithinWorkingHours(barber, dateObj, durationMinutes) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = days[dateObj.getDay()];
    const schedule = barber.working_hours[dayKey];

    if (!schedule || !schedule.active) {
      return { ok: false, reason: `El barbero no atiende los días ${dayKey}.` };
    }

    const [startH, startM] = schedule.start.split(':').map(Number);
    const [endH, endM] = schedule.end.split(':').map(Number);

    const shiftStart = new Date(dateObj);
    shiftStart.setHours(startH, startM, 0, 0);

    const shiftEnd = new Date(dateObj);
    shiftEnd.setHours(endH, endM, 0, 0);

    const appointmentEnd = new Date(dateObj.getTime() + durationMinutes * 60000);

    if (dateObj < shiftStart || appointmentEnd > shiftEnd) {
      return { 
        ok: false, 
        reason: `Fuera de horario laboral (${schedule.start} a ${schedule.end}).` 
      };
    }

    return { ok: true };
  },

  getOtherBarber(currentBarberId) {
    const active = this.getAllBarbers();
    return active.find(b => b.id !== currentBarberId) || null;
  }
};
