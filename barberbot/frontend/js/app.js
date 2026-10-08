/**
 * Recepción IA - SaaS BarberBot | Frontend Dashboard Logic (Minimalist & Crisp)
 */

const API_BASE = window.location.origin.includes(':5050') 
  ? window.location.origin 
  : 'http://localhost:5050';

let state = {
  barbers: [],
  services: [],
  appointments: [],
  finances: null,
  selectedAppointment: null
};

document.addEventListener('DOMContentLoaded', async () => {
  setupDateLabel();
  setupEventListeners();
  await loadDashboardData();
  // Polling automático cada 8 segundos
  setInterval(loadDashboardData, 8000);
});

function setupDateLabel() {
  const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  const todayStr = new Date().toLocaleDateString('es-ES', options);
  const label = document.getElementById('label-current-date');
  if (label) {
    label.textContent = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);
  }
}

async function loadDashboardData() {
  try {
    const [barbersRes, servicesRes, appointmentsRes, financesRes] = await Promise.all([
      fetch(`${API_BASE}/api/barbers`).then(r => r.json()),
      fetch(`${API_BASE}/api/services`).then(r => r.json()),
      fetch(`${API_BASE}/api/appointments`).then(r => r.json()),
      fetch(`${API_BASE}/api/finances/daily-summary`).then(r => r.json())
    ]);

    if (barbersRes.success) state.barbers = barbersRes.data;
    if (servicesRes.success) state.services = servicesRes.data;
    if (appointmentsRes.success) state.appointments = appointmentsRes.data;
    if (financesRes.success) state.finances = financesRes.data;

    renderKPIs();
    renderBarberColumns();
    populateFormSelects();
  } catch (error) {
    console.error('Error cargando datos del dashboard:', error);
  }
}

function renderKPIs() {
  if (!state.finances) return;

  const { metricas_caja, metricas_citas } = state.finances;

  document.getElementById('kpi-ingresos').textContent = 
    `$${(metricas_caja.total_ingresos || 0).toLocaleString('es-CO')}`;
  document.getElementById('kpi-desglose-pago').textContent = 
    `Efectivo: $${(metricas_caja.efectivo || 0).toLocaleString('es-CO')} | Tarjeta: $${(metricas_caja.tarjeta || 0).toLocaleString('es-CO')}`;

  document.getElementById('kpi-citas-total').textContent = metricas_citas.total_agenda;
  document.getElementById('kpi-citas-completadas').textContent = 
    `${metricas_citas.completadas} completadas | ${metricas_citas.pendientes} pendientes`;

  document.getElementById('kpi-asistencia').textContent = `${metricas_citas.tasa_asistencia}%`;
  document.getElementById('kpi-recordatorios').textContent = 
    `${metricas_citas.no_shows} no-shows prevenidos`;

  document.getElementById('kpi-comisiones').textContent = 
    `$${(metricas_caja.comisiones_barberos || 0).toLocaleString('es-CO')}`;
  document.getElementById('kpi-ganancia-neta').textContent = 
    `Ganancia neta barbería: $${(metricas_caja.ganancia_neta_barberia || 0).toLocaleString('es-CO')}`;
}

function renderBarberColumns() {
  const container = document.getElementById('barbers-container');
  if (!container) return;

  if (state.barbers.length === 0) {
    container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">No hay barberos registrados.</div>`;
    return;
  }

  container.innerHTML = state.barbers.map(barber => {
    const barberAppointments = state.appointments.filter(a => a.barber_id === barber.id);

    return `
      <div class="barber-col">
        <div class="barber-col-header">
          <div class="barber-info">
            <img src="${barber.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'}" alt="${barber.name}" class="barber-thumb">
            <div>
              <div class="barber-name-text">${barber.name}</div>
              <div class="barber-sub-text">Turno: 9:00 AM - 8:00 PM</div>
            </div>
          </div>
          <span style="font-size: 0.72rem; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">
            ${Math.round(barber.commission_rate * 100)}% com.
          </span>
        </div>

        <div class="appointments-stream">
          ${renderBarberAppointments(barber, barberAppointments)}
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.clean-apt-card').forEach(card => {
    card.addEventListener('click', () => {
      const aptId = card.getAttribute('data-id');
      openAppointmentModal(aptId);
    });
  });

  document.querySelectorAll('.clean-free-slot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const barberId = btn.getAttribute('data-barber-id');
      const timeIso = btn.getAttribute('data-time-iso');
      openNewAppointmentModalWithSlot(barberId, timeIso);
    });
  });
}

function renderBarberAppointments(barber, appointments) {
  let html = '';

  if (appointments.length === 0) {
    return `
      <div class="clean-free-slot" data-barber-id="${barber.id}" data-time-iso="${new Date().toISOString()}">
        <span><i class="fa-regular fa-clock"></i> 09:00 AM - Todo el día disponible</span>
        <span style="color: #2563eb; font-weight: 600;">+ Agendar</span>
      </div>
    `;
  }

  appointments.forEach(apt => {
    const startTime = new Date(apt.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const endTime = new Date(apt.end_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const service = state.services.find(s => s.id === apt.service_id);
    const serviceName = service ? service.name : (apt.status === 'blocked' ? 'Bloqueo Horario' : 'Servicio General');

    const statusBadge = {
      confirmed: '🟢 Confirmada',
      pending: '🟡 Apartada',
      no_show: '🔴 No asistió',
      completed: '🔵 Completada',
      blocked: '⚫ Bloqueada'
    }[apt.status] || apt.status;

    html += `
      <div class="clean-apt-card ${apt.status}" data-id="${apt.id}">
        <div class="apt-meta-row">
          <span>${startTime} - ${endTime}</span>
          <span style="font-size: 0.7rem; font-weight: 600;">${statusBadge}</span>
        </div>
        <div class="apt-client-title">${apt.client_name}</div>
        <div class="apt-desc-row">
          <span>${serviceName}</span>
          <span><strong>$${(apt.total_amount || 0).toLocaleString('es-CO')}</strong></span>
        </div>
      </div>
    `;
  });

  // Ranura sutil de hueco libre
  html += `
    <div class="clean-free-slot" data-barber-id="${barber.id}" data-time-iso="${new Date().toISOString()}">
      <span><i class="fa-regular fa-calendar-plus"></i> Espacio libre disponible</span>
      <span style="color: #2563eb; font-weight: 600;">+ Asignar</span>
    </div>
  `;

  return html;
}

function openAppointmentModal(appointmentId) {
  const apt = state.appointments.find(a => a.id === appointmentId);
  if (!apt) return;

  state.selectedAppointment = apt;
  const barber = state.barbers.find(b => b.id === apt.barber_id);
  const service = state.services.find(s => s.id === apt.service_id);

  const startTime = new Date(apt.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const endTime = new Date(apt.end_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const modalBody = document.getElementById('appointment-modal-body');
  modalBody.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.9rem;">
      <div style="background: #f8fafc; padding: 0.9rem; border-radius: 6px; border: 1px solid #e2e8f0;">
        <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">CLIENTE:</div>
        <div style="font-size: 1rem; font-weight: 700; color: #0f172a;">${apt.client_name}</div>
        <div style="font-size: 0.8rem; color: #059669; font-weight: 600; margin-top: 2px;">
          <i class="fa-brands fa-whatsapp"></i> ${apt.client_phone}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.82rem;">
        <div>
          <span style="color: #64748b;">Barbero:</span><br>
          <strong>${barber ? barber.name : 'No asignado'}</strong>
        </div>
        <div>
          <span style="color: #64748b;">Horario:</span><br>
          <strong>${startTime} - ${endTime}</strong>
        </div>
        <div>
          <span style="color: #64748b;">Servicio:</span><br>
          <strong>${service ? service.name : 'General'}</strong>
        </div>
        <div>
          <span style="color: #64748b;">Total a Pagar:</span><br>
          <strong style="color: #d97706; font-size: 0.95rem;">$${(apt.total_amount || 0).toLocaleString('es-CO')}</strong>
        </div>
      </div>

      <div style="padding-top: 0.9rem; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.5rem;">
        <span style="font-size: 0.75rem; font-weight: 600; color: #475569;">Acción de Cobro / Estado:</span>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="updateAppointmentStatus('${apt.id}', 'completed', 'cash')">
            <i class="fa-solid fa-money-bill"></i> Cobrado Efectivo
          </button>
          <button class="btn" style="background: #2563eb; color: #fff;" onclick="updateAppointmentStatus('${apt.id}', 'completed', 'card')">
            <i class="fa-solid fa-credit-card"></i> Cobrado Tarjeta
          </button>
          <button class="btn" style="background: #fee2e2; color: #b91c1c;" onclick="updateAppointmentStatus('${apt.id}', 'no_show', 'pending')">
            <i class="fa-solid fa-user-xmark"></i> Marcar Falta
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('appointment-modal').classList.add('active');
}

window.updateAppointmentStatus = async function(id, status, paymentMethod) {
  try {
    const res = await fetch(`${API_BASE}/api/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, payment_method: paymentMethod })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('appointment-modal').classList.remove('active');
      await loadDashboardData();
    }
  } catch (err) {
    alert('Error actualizando cita: ' + err.message);
  }
};

function populateFormSelects() {
  const barberSelect = document.getElementById('form-barber-select');
  const serviceSelect = document.getElementById('form-service-select');

  if (barberSelect) {
    barberSelect.innerHTML = state.barbers.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }

  if (serviceSelect) {
    serviceSelect.innerHTML = state.services.map(s => 
      `<option value="${s.id}">${s.name} ($${Number(s.price).toLocaleString('es-CO')} - ${s.duration_minutes}m)</option>`
    ).join('');
  }
}

function openNewAppointmentModalWithSlot(barberId, timeIso) {
  populateFormSelects();
  const barberSelect = document.getElementById('form-barber-select');
  if (barberSelect && barberId) barberSelect.value = barberId;

  const timeInput = document.getElementById('form-appointment-time');
  if (timeInput) {
    const d = new Date(timeIso);
    timeInput.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  document.getElementById('new-appointment-modal').classList.add('active');
}

function setupEventListeners() {
  // Drawer de WhatsApp
  const waDrawer = document.getElementById('wa-drawer');
  const btnToggleWa = document.getElementById('btn-toggle-wa');
  const btnOpenWaTop = document.getElementById('btn-open-wa-drawer');
  const btnCloseWa = document.getElementById('btn-close-wa');

  const toggleDrawer = () => waDrawer?.classList.toggle('active');
  btnToggleWa?.addEventListener('click', toggleDrawer);
  btnOpenWaTop?.addEventListener('click', toggleDrawer);
  btnCloseWa?.addEventListener('click', () => waDrawer?.classList.remove('active'));

  // Modales
  document.getElementById('btn-close-appointment-modal')?.addEventListener('click', () => {
    document.getElementById('appointment-modal').classList.remove('active');
  });

  document.getElementById('btn-new-appointment')?.addEventListener('click', () => {
    populateFormSelects();
    document.getElementById('new-appointment-modal').classList.add('active');
  });

  document.getElementById('btn-close-new-modal')?.addEventListener('click', () => {
    document.getElementById('new-appointment-modal').classList.remove('active');
  });

  // Enviar Formulario de Cita
  document.getElementById('new-appointment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const barberId = document.getElementById('form-barber-select').value;
    const serviceId = document.getElementById('form-service-select').value;
    const clientName = document.getElementById('form-client-name').value;
    const clientPhone = document.getElementById('form-client-phone').value;
    const timeVal = document.getElementById('form-appointment-time').value;
    const paymentMethod = document.getElementById('form-payment-method').value;

    const [h, m] = timeVal.split(':').map(Number);
    const aptDate = new Date();
    aptDate.setHours(h, m, 0, 0);

    const service = state.services.find(s => s.id === serviceId);

    try {
      const res = await fetch(`${API_BASE}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barber_id: barberId,
          service_id: serviceId,
          client_name: clientName,
          client_phone: clientPhone,
          datetime: aptDate.toISOString(),
          duration_minutes: service ? service.duration_minutes : 35,
          payment_method: paymentMethod,
          source: 'dashboard'
        })
      });

      const data = await res.json();
      if (data.success) {
        document.getElementById('new-appointment-modal').classList.remove('active');
        document.getElementById('new-appointment-form').reset();
        await loadDashboardData();
      } else {
        alert('⚠️ Conflicto: ' + (data.error || 'Horario ocupado.'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });

  // Chatbot Simulator
  document.getElementById('wa-chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('wa-message-input');
    const msg = input.value.trim();
    if (!msg) return;

    appendChatMessage(msg, 'out');
    input.value = '';

    try {
      const res = await fetch(`${API_BASE}/api/webhook/simulate-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: msg, 
          client_name: 'David', 
          client_phone: '+573105559988' 
        })
      });
      const data = await res.json();

      if (data.success) {
        setTimeout(() => {
          appendChatMessage(data.response, 'in');
          loadDashboardData();
        }, 300);
      }
    } catch (err) {
      appendChatMessage('Error conectando con el bot.', 'in');
    }
  });
}

function appendChatMessage(text, direction) {
  const container = document.getElementById('wa-chat-history');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `wa-msg ${direction}`;
  msgDiv.innerHTML = text.replace(/\n/g, '<br>');
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}
