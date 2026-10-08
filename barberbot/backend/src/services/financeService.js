import { db } from '../config/database.js';

export const financeService = {
  getDailySummary(dateString) {
    const targetDate = dateString 
      ? new Date(dateString).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const dayAppointments = db.appointments.filter(a => 
      a.datetime.slice(0, 10) === targetDate
    );

    let totalIngresos = 0;
    let efectivo = 0;
    let tarjeta = 0;
    let totalComisiones = 0;
    let completadas = 0;
    let noShows = 0;
    let pendientes = 0;

    const comisionesPorBarbero = {};

    db.barbers.forEach(b => {
      comisionesPorBarbero[b.id] = {
        barber_name: b.name,
        citas_atendidas: 0,
        total_generado: 0,
        comision_a_pagar: 0
      };
    });

    dayAppointments.forEach(apt => {
      if (apt.status === 'completed') {
        completadas++;
        totalIngresos += Number(apt.total_amount || 0);
        totalComisiones += Number(apt.commission_amount || 0);

        if (apt.payment_method === 'cash') {
          efectivo += Number(apt.total_amount || 0);
        } else if (apt.payment_method === 'card') {
          tarjeta += Number(apt.total_amount || 0);
        }

        if (comisionesPorBarbero[apt.barber_id]) {
          comisionesPorBarbero[apt.barber_id].citas_atendidas++;
          comisionesPorBarbero[apt.barber_id].total_generado += Number(apt.total_amount || 0);
          comisionesPorBarbero[apt.barber_id].comision_a_pagar += Number(apt.commission_amount || 0);
        }
      } else if (apt.status === 'no_show') {
        noShows++;
      } else if (['confirmed', 'pending'].includes(apt.status)) {
        pendientes++;
      }
    });

    const gananciaNetaNegocio = totalIngresos - totalComisiones;

    return {
      fecha: targetDate,
      metricas_caja: {
        total_ingresos: totalIngresos,
        efectivo,
        tarjeta,
        comisiones_barberos: totalComisiones,
        ganancia_neta_barberia: gananciaNetaNegocio
      },
      metricas_citas: {
        total_agenda: dayAppointments.length,
        completadas,
        no_shows: noShows,
        pendientes,
        tasa_asistencia: dayAppointments.length > 0 
          ? Math.round((completadas / (completadas + noShows || 1)) * 100) 
          : 100
      },
      desglose_barberos: Object.values(comisionesPorBarbero)
    };
  }
};
