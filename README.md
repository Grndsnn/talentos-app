# Talent Intelligence OS — Documentación Técnica y Guía de Arquitectura

Bienvenido a la documentación oficial de **Talent Intelligence OS**, una plataforma moderna para gestión de vacantes, ingesta y evaluación de CVs con inteligencia artificial, integrada con el ecosistema de 6 agentes autónomos de **AG Kit**.

---

## 📑 Tabla de Contenidos
1. [Resumen de la Transformación (Monolito a Modular)](#1-resumen-de-la-transformación)
2. [Estructura del Proyecto y Capas de Código](#2-estructura-del-proyecto)
3. [Gestión y Eliminación de CVs](#3-gestión-y-eliminación-de-cvs)
4. [Representación Gráfica del Ecosistema de Agentes](#4-representación-gráfica-del-ecosistema-de-agentes)
5. [Roles y Herramientas de los 6 Agentes](#5-roles-y-herramientas-de-los-6-agentes)
6. [Cómo Ejecutar y Probar la Aplicación](#6-cómo-ejecutar-y-probar-la-aplicación)

---

## 1. Resumen de la Transformación

### Estado Inicial (`app.html`):
- Archivo monolítico único de 595 líneas.
- CSS, marcado HTML, llamadas a la API de Supabase, envío a n8n y manipulación del DOM fuertemente acoplados en el mismo archivo.
- Dificultad para mantener, extender funcionalidades o aislar fallos.

### Estado Actual (`app/`):
- **Cero estilos inline y cero scripts inline**.
- Separación estricta de responsabilidades (SoC):
  - **Capa de Presentación (UI)**: `index.html` + `css/`
  - **Capa de Servicios y Datos**: `js/services/`
  - **Capa de Controladores**: `js/controllers/`
  - **Capa de Configuración**: `js/config.js`
- Servidor HTTP nativo en Node.js (`server.js`) de **cero dependencias externas**.

---

## 2. Estructura del Proyecto

```
app/
├── index.html                   # Marcado HTML5 semántico y accesible
├── server.js                    # Servidor estático Node.js (cero dependencias)
├── css/
│   ├── main.css                 # Tokens de diseño, reset, variables CSS y botones
│   ├── layout.css               # Sidebar de navegación, header y login screen
│   ├── dashboard.css            # Grid de métricas, controles, tablas y modal
│   └── agents.css               # Topología gráfica, terminal y avatares con pulso
├── js/
│   ├── config.js                # Parámetros centralizados (Supabase, n8n, Agentes)
│   ├── services/
│   │   ├── supabase.js          # Consultas, inserciones y eliminaciones en DB
│   │   ├── n8n.js               # Ingesta de archivos PDF al Webhook de n8n
│   │   └── telemetry.js         # Interceptor y registro de eventos para Debugger
│   ├── controllers/
│   │   ├── auth.js              # Manejo de sesiones y pantalla de acceso
│   │   ├── dashboard.js         # KPIs, filtros, búsqueda, tabla y borrado de CVs
│   │   ├── vacantes.js          # Renderizado y navegación entre vacantes
│   │   └── agents.js            # Lógica interactiva de los 6 agentes y topología gráfica
│   └── app.js                   # Bootstrap global y enrutamiento entre vistas
└── README.md                    # Esta guía técnica
```

---

## 3. Gestión y Eliminación de CVs

Se incorporó un mecanismo seguro y reactivo para eliminar CVs y candidatos:

### ¿Dónde se encuentra el botón de eliminar?
1. **En la Tabla del Dashboard**: Cada fila cuenta con una columna de **Acción** con un botón de papelera roja (`btn-danger` / `fa-trash-can`). Al hacer clic, se aísla el evento (`event.stopPropagation()`) para no abrir el modal por accidente.
2. **En el Modal de Detalle del Candidato**: En el pie del modal se incluye el botón **"Eliminar este CV"**.

### Flujo de Eliminación:
```
Usuario hace clic en "Eliminar" 
   │
   ▼
Ventana de confirmación de seguridad (¿Estás seguro?)
   │
   ▼
Llamada a supabaseService.deleteCandidate(id, email, vacante_id)
   │
   ▼
Ejecución en Supabase: client.from('candidates').delete().eq(...)
   │
   ▼
Registro en Telemetría (Debugger) + Cierre del modal
   │
   ▼
Recarga automática de candidatos y recálculo reactivo de KPIs
```

---

## 4. Representación Gráfica del Ecosistema de Agentes

Los agentes ahora cuentan con presencia visual en toda la aplicación:

### A. Barra Visual en el Dashboard (`#dashboardAgentStripContainer`):
- Ubicada directamente sobre la grilla de métricas en el Dashboard.
- Muestra tarjetas redondeadas para cada uno de los 6 agentes con su icono, nombre, color distintivo y un **punto de pulso verde animado**.
- Al hacer clic en cualquier agente de la barra, la aplicación navega directamente al Centro de Agentes y selecciona a ese especialista.

### B. Mapa Topológico Gráfico en el Centro de Agentes:
- Un lienzo visual con estilo oscuro / cyberpunk.
- **Nodo Maestro Central**: El **Orchestrator** con un avatar circular grande de 58px, aura luminosa azul/cian y anillo orbital con animación rotativa (`rotateRing`).
- **Nodos Especialistas Conectados**: Distribución horizontal de los 5 agentes especializados con tarjetas traslúcidas de fondo blur, iconos de colores e indicadores de pulso de actividad en tiempo real.
- Al hacer clic en cualquier nodo gráfico, se selecciona automáticamente en la consola y se activan sus herramientas.

---

## 5. Roles y Herramientas de los 6 Agentes

| Agente | Color | Icono | Herramientas Disponibles en la App |
|---|---|---|---|
| **Orchestrator** | Azul `#2563eb` | `fa-sitemap` | Auditoría integral del sistema, orquestación multi-agente en paralelo, matriz de capacidades. |
| **Backend Specialist** | Esmeralda `#059669` | `fa-server` | Ping y latencia en vivo a Supabase, comprobación de webhook n8n, inspector de esquema SQL. |
| **Code Archaeologist** | Ámbar `#d97706` | `fa-landmark` | Comparativa monolito vs modular, análisis de dependencias, principio de Chesterton. |
| **Debugger** | Rosa `#e11d48` | `fa-bug` | Consola de telemetría en vivo, diagnóstico de 4 fases, simulación de fallos y auto-remedio. |
| **Project Planner** | Cian `#0891b2` | `fa-diagram-project` | Tablero de sprints activo, creación de nuevas tareas en el roadmap, reporte de avance del MVP. |
| **Test Engineer** | Violeta `#7c3aed` | `fa-vial-circle-check` | Suite de 5 pruebas TDD automatizadas en vivo con cronómetro, inyector de candidatos sintéticos (mock). |

---

## 6. Cómo Ejecutar y Probar la Aplicación

### Servidor Local:
El servidor se ejecuta en Node.js desde la raíz del proyecto o dentro de `app/`:
```bash
node app/server.js
```
Accede desde tu navegador en:
👉 **[http://localhost:5500](http://localhost:5500)**

### Credenciales:
- **Usuario**: `admin`
- **Contraseña**: `admin`
