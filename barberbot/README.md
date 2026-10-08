# 💈 SaaS BarberBot IA — Recepción IA

> **Sistema Inteligente de Recepción, Agendamiento por WhatsApp y Control de Negocio para Barberías**

---

## 🌟 Visión del Producto

BarberBot IA convierte el chat caótico de WhatsApp de una barbería en un **centro de control operativo de alta precisión**, ofreciendo:
1. **Recepción Virtual 24/7 con Inteligencia Artificial:** Clasifica intenciones de clientes, cotiza servicios y reserva citas automáticamente respetando los horarios laborales.
2. **Prevención de Doble Reserva (Collision Guard):** Validación matemática en tiempo real que impide solapamiento de horarios entre barberos.
3. **Agenda Multi-Barbero Interactiva:** Visualización por columnas para barberos (Toño, Memo, Carlos) con detección inteligente de "huecos libres" para reasignación rápida.
4. **Motor Anti-No-Show:** Recordatorios automatizados programados a las 24 horas y 2 horas antes de la cita con botones de confirmación o liberación de espacio.
5. **Control de Caja y Comisiones:** Reportes en vivo de ingresos en efectivo vs tarjeta y cálculo automático de comisiones por barbero.

---

## 🏗️ Arquitectura de Tres Servicios Desacoplados

```
barberbot/
├── database/
│   ├── schema.sql              # DDL PostgreSQL / Supabase con RLS, colas y funciones
│   └── seed.sql                # Barberos, catálogo de servicios y citas iniciales
├── backend/
│   ├── package.json            # Configuración ESM y dependencias
│   ├── .env.example            # Variables de entorno
│   └── src/
│       ├── server.js           # Orquestador: Inicia API, Gateway y Worker
│       ├── config/
│       │   ├── database.js     # Estado en Postgres (conversations, messages, pending_actions)
│       │   └── environment.js  # Configuración
│       ├── services/
│       │   ├── whatsappGateway.js # SERVICIO 1: Ingesta en cola (<50ms) y despacho WhatsApp
│       │   ├── queueWorker.js     # SERVICIO 2: Worker con colas Postgres (1 turno/conv, paralelo)
│       │   ├── aiClassifier.js    # Clasificador gpt-5-mini con ventana estricta de 12 mensajes
│       │   ├── appointmentService.js # Lógica de disponibilidad y colisiones
│       │   ├── barberService.js   # Gestión de horarios y barberos
│       │   └── financeService.js  # Control de caja y comisiones
│       ├── controllers/
│       │   ├── webhookController.js # Gateway webhook, simulador y estado de colas
│       │   ├── appointmentController.js # Endpoints de agenda
│       │   └── financeController.js # Endpoints de caja
│       └── routes/
│           └── apiRoutes.js    # SERVICIO 3: Enrutador de API REST
├── n8n/
│   ├── barberbot-whatsapp-ai-agent.json # Flujo Webhook Meta + IA (n8n: V7SmyGow7H8H75wo)
│   └── barberbot-anti-no-show-cron.json  # Flujo Cron recordatorios anti-faltas (n8n: N0M1WvTLACxf9tiE)
├── frontend/
│   ├── index.html              # Dashboard operativo "Recepción IA"
│   ├── css/style.css           # Sistema de diseño premium
│   └── js/app.js               # Conexión en vivo, agenda y simulador
└── tests/
    └── api.test.js             # Suite de 7 pruebas automatizadas (100% pasando)
```

### ⚙️ Flujo Operativo y Pipeline de Decisión

1. **Persistencia Total del Estado en Postgres:**
   - Tablas `conversations`, `messages` y `pending_actions`.
2. **Concurrencia y Serialización:**
   - **1 turno a la vez por conversación:** El worker bloquea la conversación activa para procesar sus mensajes estrictamente en orden cronológico.
   - **Múltiples conversaciones en paralelo:** Si llegan mensajes de diferentes usuarios, se procesan concurrentemente sin interferencia.
3. **Pre-Filtro de Reglas (SIN IA ANTES):**
   - **`blocked`:** Usuario en lista negra/spam; no gasta tokens ni se procesa.
   - **`bot_paused`:** Bot apagado por el barbero/dueño; el mensaje queda registrado en Postgres para atención humana directa.
   - **`suspended`:** Cuenta suspendida; despacha mensaje administrativo fijo sin IA.
4. **Clasificación y Tool Calling con `gpt-5-mini`:**
   - **Ventana de Contexto Estricta:** El modelo **solo ve los últimos 12 mensajes** de la conversación en Postgres.
   - **Herramientas Disponibles:**
     - ✂️ `cita`: Agendar o consultar disponibilidad en tiempo real con barberos (Toño, Memo, Carlos).
     - 📝 `recado_al_dueno`: Asuntos comerciales, cotizaciones o mensajes para el propietario.
     - 🚨 `traspaso_urgente`: Clientes molestos o peticiones de humano; apaga el bot automáticamente (`bot_paused`) y notifica al personal.
5. **Post-Filtro (Filtro DESPUÉS):**
   - Validación y sanitización estricta antes de responder al cliente por WhatsApp.

---

## 🚀 Despliegue y Ejecución Local

### 1. Iniciar el Servidor y Dashboard
```bash
cd barberbot/backend
npm install
npm start
```

- **Dashboard Web:** `http://localhost:5050/`
- **Healthcheck:** `http://localhost:5050/health`
- **Webhook de WhatsApp:** `http://localhost:5050/api/webhook/whatsapp`

---

## ⚡ Flujos de n8n Desplegados

Los flujos han sido configurados y sincronizados con tu instancia de n8n:
- **Flujo 1 (Anti-Faltas):** `BarberBot IA - Recordatorios Anti-Faltas (Cron 2h y 24h)` (ID: `N0M1WvTLACxf9tiE`)
- **Flujo 2 (Recepción IA):** `BarberBot IA - Recepción WhatsApp y Asistente de Citas` (ID: `V7SmyGow7H8H75wo`)
- Archivos locales exportados en `barberbot/n8n/` para respaldo y versionamiento Git.

---

## 📡 API Endpoints Principales

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/barbers` | Lista de barberos activos y porcentajes de comisión |
| `GET` | `/api/services` | Catálogo de servicios y precios |
| `GET` | `/api/availability/slots` | Devuelve huecos libres exactos por barbero y fecha |
| `GET` | `/api/availability/check` | Valida si un intervalo de tiempo está disponible |
| `GET` | `/api/appointments` | Listado de citas filtrables por barbero, fecha o estado |
| `POST` | `/api/appointments` | Agendamiento de cita con validación anti-solapamiento |
| `PATCH` | `/api/appointments/:id/status` | Actualiza estado (`completed`, `no_show`) y método de pago |
| `GET` | `/api/finances/daily-summary` | Resumen de ingresos, desglose efectivo/tarjeta y comisiones |
| `GET` | `/api/webhook/whatsapp` | Verificación de challenge de Meta Cloud API (`hub.verify_token`) |
| `POST` | `/api/webhook/whatsapp` | Ingesta de mensajes entrantes de clientes desde WhatsApp |
| `POST` | `/api/webhook/simulate-chat` | Simulador interactivo del bot para el dashboard |

---

## 🧪 Pruebas Automatizadas

Para ejecutar la suite de pruebas unitarias y de integración:
```bash
npm test
```
Resultados:
- ✅ **Barber Service:** Validación de catálogo de barberos y turnos.
- ✅ **Availability Service:** Detección estricta de colisión ante solapamiento de horarios.
- ✅ **Finance Service:** Cuadre de caja, desglose efectivo/tarjeta y comisiones.
- ✅ **Anti-No-Show:** Detección de citas en la ventana de 2h y 24h.
