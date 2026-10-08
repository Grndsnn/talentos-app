import test from 'node:test';
import assert from 'node:assert/strict';
import { barberService } from '../backend/src/services/barberService.js';
import { appointmentService } from '../backend/src/services/appointmentService.js';
import { financeService } from '../backend/src/services/financeService.js';
import { aiClassifier } from '../backend/src/services/aiClassifier.js';
import { QueueWorker } from '../backend/src/services/queueWorker.js';
import { db } from '../backend/src/config/database.js';

test('1. Barber Service - Debe listar los 2 barberos activos de la barbería (Toño y Memo)', () => {
  const barbers = barberService.getAllBarbers();
  assert.equal(barbers.length, 2, 'Debe haber exactamente 2 barberos activos');
  const tono = barberService.findBarberByName('Toño');
  const memo = barberService.findBarberByName('Memo');
  assert.ok(tono, 'Debe encontrar al barbero Toño');
  assert.ok(memo, 'Debe encontrar al barbero Memo');
  assert.equal(tono.commission_rate, 0.45);
});

test('2. Availability Service - Debe detectar colisión si dos citas se solapan en el mismo barbero', () => {
  const tono = barberService.findBarberByName('Toño');
  const testDate = new Date();
  testDate.setHours(17, 0, 0, 0); // 5:00 PM

  const initialCheck = appointmentService.checkAvailability(tono.id, testDate.toISOString(), 35);
  assert.equal(initialCheck.available, true, 'Debe estar disponible a las 5:00 PM');

  const appointment = appointmentService.createAppointment({
    barber_id: tono.id,
    service_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    client_name: 'Test QA User',
    client_phone: '+573009998877',
    datetime: testDate.toISOString(),
    duration_minutes: 35
  });

  assert.ok(appointment.id, 'Cita creada exitosamente');

  const collisionDate = new Date(testDate);
  collisionDate.setMinutes(15);

  const collisionCheck = appointmentService.checkAvailability(tono.id, collisionDate.toISOString(), 35);
  assert.equal(collisionCheck.available, false, 'Debe rechazar la colisión horaria');
  assert.match(collisionCheck.reason, /ya tiene una cita asignada/);
});

test('3. Finance Service - Cálculo correcto de ingresos, efectivo/tarjeta y comisiones', () => {
  const summary = financeService.getDailySummary();
  assert.ok(summary.metricas_caja, 'Debe contener las métricas de caja');
  assert.equal(summary.desglose_barberos.length, 2, 'Debe contener el desglose de los 2 barberos');
  assert.equal(
    summary.metricas_caja.total_ingresos,
    summary.metricas_caja.efectivo + summary.metricas_caja.tarjeta,
    'Total de ingresos debe ser la suma de efectivo + tarjeta'
  );
  assert.ok(summary.metricas_caja.ganancia_neta_barberia >= 0, 'La ganancia neta no puede ser negativa');
});

test('4. Ventana de Contexto Postgres - El modelo solo ve los últimos 12 mensajes', () => {
  const conv = db.getOrCreateConversation('+573001112233', 'Usuario Ventana');

  // Insertar 20 mensajes de prueba
  for (let i = 1; i <= 20; i++) {
    db.addMessage(conv.id, i % 2 === 0 ? 'assistant' : 'user', `Mensaje número ${i}`);
  }

  const window12 = db.getRecent12Messages(conv.id);
  assert.equal(window12.length, 12, 'Debe devolver exactamente los últimos 12 mensajes');
  assert.equal(window12[11].content, 'Mensaje número 20', 'El último mensaje debe ser el más reciente');
  assert.equal(window12[0].content, 'Mensaje número 9', 'El primer mensaje de la ventana debe ser el noveno');
});

test('5. Reglas sin IA antes - Bloqueado, Bot apagado y Suspendido', async () => {
  const worker = new QueueWorker('worker-test-rules');

  // Caso A: Contacto Bloqueado
  const convBlocked = db.getOrCreateConversation('+573000000001', 'Spam User');
  convBlocked.status = 'blocked';
  db.addMessage(convBlocked.id, 'user', 'Mensaje de spam');
  const jobBlocked = db.enqueueAction(convBlocked.id, 'incoming_whatsapp_message', { text: 'Spam' });
  await worker.processNextJob();
  assert.equal(jobBlocked.status, 'completed', 'Job debe cerrarse sin invocar IA');

  // Caso B: Bot Apagado (Atención humana directa)
  const convPaused = db.getOrCreateConversation('+573000000002', 'Cliente Humano');
  convPaused.status = 'bot_paused';
  db.addMessage(convPaused.id, 'user', 'Hola, necesito hablar con el barbero');
  const jobPaused = db.enqueueAction(convPaused.id, 'incoming_whatsapp_message', { text: 'Ayuda humana' });
  await worker.processNextJob();
  assert.equal(jobPaused.status, 'completed', 'Job debe completarse dejando mensaje para atención humana');

  // Caso C: Cuenta Suspendida
  const convSusp = db.getOrCreateConversation('+573000000003', 'Cliente Suspendido');
  convSusp.status = 'suspended';
  db.addMessage(convSusp.id, 'user', 'Quiero agendar');
  const jobSusp = db.enqueueAction(convSusp.id, 'incoming_whatsapp_message', { text: 'Agendar' });
  await worker.processNextJob();
  assert.equal(jobSusp.status, 'completed');
  const lastMsg = db.messages.filter(m => m.conversation_id === convSusp.id).slice(-1)[0];
  assert.match(lastMsg.content, /temporalmente suspendida/, 'Debe enviar aviso administrativo sin IA');
});

test('6. Clasificación gpt-5-mini - Herramientas (cita, recado_al_dueno, traspaso_urgente)', async () => {
  // Test Herramienta 1: Cita
  const convCita = db.getOrCreateConversation('+573111111111', 'Cliente Cita');
  db.addMessage(convCita.id, 'user', 'Quiero agendar corte clásico con Toño para mañana');
  const resCita = await aiClassifier.classifyAndSelectTool(convCita.id);
  assert.equal(resCita.model_used, 'gpt-5-mini');
  assert.equal(resCita.tool_calls[0].function.name, 'cita');

  // Test Herramienta 2: Recado al Dueño
  const convRecado = db.getOrCreateConversation('+573112222222', 'Proveedor');
  db.addMessage(convRecado.id, 'user', 'Hola, le dejo un recado al dueño para cotización de productos al por mayor');
  const resRecado = await aiClassifier.classifyAndSelectTool(convRecado.id);
  assert.equal(resRecado.tool_calls[0].function.name, 'recado_al_dueno');

  // Test Herramienta 3: Traspaso Urgente
  const convUrgente = db.getOrCreateConversation('+573113333333', 'Cliente Reclamo');
  db.addMessage(convUrgente.id, 'user', 'Tengo una queja urgente y exijo hablar con una persona humana');
  const resUrgente = await aiClassifier.classifyAndSelectTool(convUrgente.id);
  assert.equal(resUrgente.tool_calls[0].function.name, 'traspaso_urgente');
});

test('7. Concurrencia en Postgres - 1 turno a la vez por conversación y paralelo para otras', () => {
  const convA = db.getOrCreateConversation('+573220000001', 'Cliente A');
  const convB = db.getOrCreateConversation('+573220000002', 'Cliente B');

  // Encolar dos jobs seguidos para la conversación A
  const jobA1 = db.enqueueAction(convA.id, 'incoming_whatsapp_message', { step: 1 });
  const jobA2 = db.enqueueAction(convA.id, 'incoming_whatsapp_message', { step: 2 });

  // Encolar un job para la conversación B
  const jobB1 = db.enqueueAction(convB.id, 'incoming_whatsapp_message', { step: 1 });

  // Worker 1 toma job de conversación A
  const dequeued1 = db.dequeueNextAction('worker-1');
  assert.equal(dequeued1.id, jobA1.id, 'Debe tomar el primer job de la conversación A');
  assert.equal(dequeued1.status, 'processing');

  // Worker 2 intenta tomar el siguiente job: Debe saltear jobA2 (porque convA está processing) y tomar jobB1 en paralelo!
  const dequeued2 = db.dequeueNextAction('worker-2');
  assert.equal(dequeued2.id, jobB1.id, 'Debe procesar la conversación B en paralelo sin bloquearse por la A');

  // Intento de tomar un tercer job mientras convA y convB siguen ocupadas: debe retornar null
  const dequeued3 = db.dequeueNextAction('worker-3');
  assert.equal(dequeued3, null, 'No debe procesar jobA2 hasta que jobA1 termine');

  // Liberar jobA1
  db.finishAction(jobA1.id, true);

  // Ahora sí jobA2 puede ser procesado
  const dequeued4 = db.dequeueNextAction('worker-1');
  assert.equal(dequeued4.id, jobA2.id, 'Ahora sí procesa el segundo turno de la conversación A');
});

test('8. Cross-Barber Recommendation - Si Toño está ocupado a las 5:00 PM, recomienda a Memo si está libre', () => {
  const tono = barberService.findBarberByName('Toño');
  const memo = barberService.findBarberByName('Memo');

  // En test 2 se creó una cita confirmada para Toño a las 17:00 (5:00 PM)
  const today5pm = new Date();
  today5pm.setHours(17, 0, 0, 0);

  const cross = appointmentService.checkCrossBarberAvailability(tono.id, today5pm.toISOString(), 35);
  assert.equal(cross.primaryAvailable, false, 'Toño debe estar ocupado a las 5:00 PM');
  assert.equal(cross.otherBarber.id, memo.id, 'El barbero alternativo debe ser Memo');
  assert.equal(cross.otherAvailable, true, 'Memo debe estar disponible a las 5:00 PM para ofrecerse como alternativa');
});

test('9. Slot Availability Exclusion - Si se confirma una cita a las 9:30 AM, ya NO debe aparecer disponible en el texto', () => {
  const tono = barberService.findBarberByName('Toño');
  const targetDateStr = '2026-10-15'; // Fecha específica de prueba (Jueves)

  // 1. Obtener cupos antes de reservar
  const slotsBefore = appointmentService.getAvailableSlots(tono.id, targetDateStr, 35);
  const has930Before = slotsBefore.some(s => s.time.includes('09:30') || s.time.includes('9:30'));
  assert.ok(has930Before, 'Las 9:30 AM debería estar disponible antes de apartar con Toño');

  // 2. Crear la cita a las 9:30 AM
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const aptDate = new Date(y, m - 1, d, 9, 30, 0, 0);

  const newApt = appointmentService.createAppointment({
    barber_id: tono.id,
    service_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    client_name: 'Cliente Prueba Cupo',
    client_phone: '+573155554433',
    datetime: aptDate.toISOString(),
    duration_minutes: 35
  });
  assert.ok(newApt.id, 'Cita creada exitosamente');

  // 3. Obtener cupos después de reservar
  const slotsAfter = appointmentService.getAvailableSlots(tono.id, targetDateStr, 35);
  const has930After = slotsAfter.some(s => s.time.includes('09:30') || s.time.includes('9:30'));
  assert.equal(has930After, false, 'Las 9:30 AM NO debe aparecer en los cupos disponibles una vez confirmada');
});

test('10. Servicios y Tarifas - Corte Normal a 22k y Corte con Barba a 27k', () => {
  const corteNormal = db.services.find(s => s.id === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  const corteBarba = db.services.find(s => s.id === 'cccccccc-cccc-cccc-cccc-cccccccccccc');
  const perfiladoBarba = db.services.find(s => s.id === 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

  assert.ok(corteNormal, 'Debe existir el servicio de Corte Normal');
  assert.equal(corteNormal.price, 22000, 'El precio del corte normal debe ser 22.000 ($22k)');

  assert.ok(corteBarba, 'Debe existir el servicio de Corte con Barba');
  assert.equal(corteBarba.price, 27000, 'El precio del corte con barba debe ser 27.000 ($27k)');

  assert.ok(perfiladoBarba, 'Debe existir perfilado de barba');
  assert.equal(perfiladoBarba.price, 15000, 'El perfilado de barba debe ser 15.000 ($15k)');
});

