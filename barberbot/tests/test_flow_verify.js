import { QueueWorker } from '../backend/src/services/queueWorker.js';
import { db } from '../backend/src/config/database.js';
import { appointmentService } from '../backend/src/services/appointmentService.js';
import { barberService } from '../backend/src/services/barberService.js';
import assert from 'node:assert/strict';

async function testEndToEndConversation() {
  console.log('🧪 Iniciando verificación del flujo conversacional...');
  const worker = new QueueWorker('worker-e2e-test');

  // Conversación de David
  const phone = '+573108889900';
  const conv = db.getOrCreateConversation(phone);

  // Turno 1: "Hola, me llamo David"
  console.log('\n--- Turno 1: Saludo e identificación ---');
  db.addMessage(conv.id, 'user', 'Hola, me llamo David');
  db.enqueueAction(conv.id, 'incoming_whatsapp_message', { text: 'Hola, me llamo David' });
  await worker.processNextJob();

  let lastAssistantMsg = db.messages.filter(m => m.conversation_id === conv.id && m.role === 'assistant').slice(-1)[0];
  console.log('Respuesta Bot:', lastAssistantMsg.content);
  assert.match(lastAssistantMsg.content, /David/i, 'Debe saludar por su nombre');
  assert.match(lastAssistantMsg.content, /22\.000/, 'Debe mencionar tarifa de 22k');
  assert.match(lastAssistantMsg.content, /27\.000/, 'Debe mencionar tarifa de 27k');

  // Turno 2: "Quiero cita con Toño a las 9:30 am con barba"
  console.log('\n--- Turno 2: Reserva con corte con barba ---');
  db.addMessage(conv.id, 'user', 'Quiero cita con Toño a las 9:30 am con barba');
  db.enqueueAction(conv.id, 'incoming_whatsapp_message', { text: 'Quiero cita con Toño a las 9:30 am con barba' });
  await worker.processNextJob();

  lastAssistantMsg = db.messages.filter(m => m.conversation_id === conv.id && m.role === 'assistant').slice(-1)[0];
  console.log('Respuesta Bot:', lastAssistantMsg.content);
  assert.match(lastAssistantMsg.content, /Corte con Barba/i, 'Debe confirmar Corte con Barba');
  assert.match(lastAssistantMsg.content, /27\.000/, 'Debe confirmar precio de 27.000');
  assert.match(lastAssistantMsg.content, /09:30|9:30/, 'Debe confirmar hora 9:30');

  // Turno 3: Otro cliente consulta disponibilidad
  console.log('\n--- Turno 3: Verificación de cupos libres (9:30 NO debe aparecer) ---');
  const tono = barberService.findBarberByName('Toño');
  const todayStr = new Date().toLocaleDateString('en-CA');
  const slots = appointmentService.getAvailableSlots(tono.id, todayStr, 35);
  const has930 = slots.some(s => s.time.includes('09:30') || s.time.includes('9:30'));
  console.log('Cupos disponibles hoy para Toño:', slots.slice(0, 5).map(s => s.time).join(', '));
  assert.equal(has930, false, '¡9:30 AM NO debe aparecer disponible!');

  // Turno 4: Cliente 2 intenta pedir a las 9:30 am
  console.log('\n--- Turno 4: Segundo cliente intenta pedir a las 9:30 AM con Toño ---');
  const conv2 = db.getOrCreateConversation('+573101112244', 'Carlos Cliente');
  db.addMessage(conv2.id, 'user', 'Quiero cita con Toño a las 9:30 am corte normal');
  db.enqueueAction(conv2.id, 'incoming_whatsapp_message', { text: 'Quiero cita con Toño a las 9:30 am corte normal' });
  await worker.processNextJob();

  const lastAssistantMsg2 = db.messages.filter(m => m.conversation_id === conv2.id && m.role === 'assistant').slice(-1)[0];
  console.log('Respuesta Bot a Cliente 2:', lastAssistantMsg2.content);
  assert.match(lastAssistantMsg2.content, /ya está ocupado|ocupados/i, 'Debe indicar que Toño está ocupado a las 9:30');
  // Verificar que en los horarios libres sugeridos en el texto NO aparezca 9:30 AM para Toño
  assert.equal(
    lastAssistantMsg2.content.includes('Toño: 09:30 AM') || lastAssistantMsg2.content.includes('Toño: 9:30 AM'),
    false,
    'El texto de horarios libres sugeridos NO debe contener 9:30 AM para Toño'
  );

  // Turno 5: Usuario pide cita SIN indicar tipo de corte -> El bot DEBE pedir el tipo de corte
  console.log('\n--- Turno 5: Cliente pide cita SIN indicar tipo de corte ---');
  const conv3 = db.getOrCreateConversation('+573103334455', 'Mateo');
  db.addMessage(conv3.id, 'user', 'Quiero una cita a las 11:30 am con Toño');
  db.enqueueAction(conv3.id, 'incoming_whatsapp_message', { text: 'Quiero una cita a las 11:30 am con Toño' });
  await worker.processNextJob();

  const msgAskCut = db.messages.filter(m => m.conversation_id === conv3.id && m.role === 'assistant').slice(-1)[0];
  console.log('Respuesta Bot (debe pedir tipo de corte):', msgAskCut.content);
  assert.match(msgAskCut.content, /qué tipo de corte deseas/i, 'Debe pedir el tipo de corte si no se le indicó');
  assert.match(msgAskCut.content, /Corte Normal.*22\.000/i, 'Debe indicar opción de corte normal 22k');
  assert.match(msgAskCut.content, /Corte con Barba.*27\.000/i, 'Debe indicar opción de corte con barba 27k');

  // Turno 6: Mateo responde "solo corte, sin barba" -> El bot debe confirmar la cita con Corte Normal
  console.log('\n--- Turno 6: Cliente responde "solo corte, sin barba" ---');
  db.addMessage(conv3.id, 'user', 'solo corte, sin barba');
  db.enqueueAction(conv3.id, 'incoming_whatsapp_message', { text: 'solo corte, sin barba' });
  await worker.processNextJob();

  const msgConfirmCut = db.messages.filter(m => m.conversation_id === conv3.id && m.role === 'assistant').slice(-1)[0];
  console.log('Respuesta Bot (debe confirmar la cita agendada):', msgConfirmCut.content);
  assert.match(msgConfirmCut.content, /Corte Normal/i, 'Debe confirmar Corte Normal');
  assert.match(msgConfirmCut.content, /22\.000/i, 'Debe confirmar precio de 22.000');
  assert.equal(msgConfirmCut.content.includes('aquí tienes la disponibilidad'), false, '¡NO debe responder con la lista de horarios!');

  // Turno 7: Mateo cambia de opinión: "mejor con barba" -> El bot debe actualizar la cita a Corte con Barba
  console.log('\n--- Turno 7: Cliente cambia a "mejor con barba" ---');
  db.addMessage(conv3.id, 'user', 'mejor con barba');
  db.enqueueAction(conv3.id, 'incoming_whatsapp_message', { text: 'mejor con barba' });
  await worker.processNextJob();

  const msgUpdateCut = db.messages.filter(m => m.conversation_id === conv3.id && m.role === 'assistant').slice(-1)[0];
  console.log('Respuesta Bot (debe actualizar a Corte con Barba):', msgUpdateCut.content);
  assert.match(msgUpdateCut.content, /Corte con Barba/i, 'Debe actualizar a Corte con Barba');
  assert.match(msgUpdateCut.content, /27\.000/i, 'Debe actualizar a precio de 27.000');
  assert.equal(msgUpdateCut.content.includes('aquí tienes la disponibilidad'), false, '¡NO debe repetir la disponibilidad!');

  console.log('\n🎉 ¡TODAS LAS VALIDACIONES DE CONVERSACIÓN Y CUPOS PASARON CON ÉXITO!');
}

testEndToEndConversation().catch(err => {
  console.error('❌ Error en test e2e:', err);
  process.exit(1);
});
