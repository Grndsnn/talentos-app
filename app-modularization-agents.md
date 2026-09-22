# Plan de Implementación: Modularización de App y Centro de Agentes

## Resumen Ejecutivo
Transformar el archivo monolítico `app.html` (595 líneas con estilos, lógica y vistas acopladas) en una arquitectura web modular y mantenible dentro de la carpeta `app/`, integrando una **Interfaz de Agentes Inteligentes 100% Funcional** basada en los 6 agentes del proyecto:
1. `orchestrator`
2. `backend-specialist`
3. `code-archaeologist`
4. `debugger`
5. `project-planner`
6. `test-engineer`

---

## Estructura de Archivos Implementada (`app/`)

```
app/
├── index.html                   # HTML semántico desacoplado, accesible y optimizado
├── css/
│   ├── main.css                 # Variables de diseño, reset, tipografía y utilidades
│   ├── layout.css               # Sidebar, header, navegación y contenedores principales
│   ├── dashboard.css            # KPIs, filtros, tablas de candidatos y modal de detalle
│   └── agents.css               # Consola cyberpunk/moderna para el centro de operaciones de agentes
├── js/
│   ├── config.js                # Constantes del entorno (Supabase URL, Key, Webhook n8n, Agentes)
│   ├── services/
│   │   ├── supabase.js          # Cliente Supabase, consultas de vacantes, candidatos y base de talentos
│   │   ├── n8n.js               # Ingesta de CVs hacia el Webhook de n8n con telemetría
│   │   └── telemetry.js         # Interceptor de logs y eventos para el agente Debugger
│   ├── controllers/
│   │   ├── auth.js              # Gestión de sesiones y autenticación
│   │   ├── dashboard.js         # Lógica del dashboard, métricas, filtros y modal
│   │   ├── vacantes.js          # Renderizado de vacantes activas y navegación
│   │   └── agents.js            # Lógica interactiva y ejecutable de los 6 agentes
│   └── app.js                   # Bootstrap de la aplicación y ciclo de vida
└── README.md                    # Guía técnica de la aplicación y manual de agentes
```

---

## Asignación y Roles de los Agentes

| Agente | Responsabilidad y Capacidades en la Interfaz |
|---|---|
| 🧠 **Orchestrator** | Auditoría integral del sistema, síntesis de estado, pipeline de verificación completa entre todos los agentes. |
| ⚙️ **Backend Specialist** | Verificación de salud y conectividad de Supabase, análisis de tablas `vacantes` y `candidates`, validación de endpoint n8n. |
| 🏛️ **Code Archaeologist** | Inspección de arquitectura antes/después, métricas de deuda técnica, descomposición del monolito y análisis de dependencias. |
| 🐛 **Debugger** | Monitor en tiempo real de logs del sistema, interceptor de peticiones de red/API, diagnóstico de fallos y botón de auto-remedio. |
| 📋 **Project Planner** | Roadmap interactivo de TalentOS, tablero de tareas y sprints (Backlog, En Curso, Completado), cálculo de progreso. |
| 🧪 **Test Engineer** | Suite de pruebas unitarias/integración en vivo (Supabase, filtros, métricas, webhook), inyector de candidatos sintéticos (Mock Generator). |

---

## Criterios de Éxito
- [x] Separación estricta de responsabilidades (HTML sin `<style>` ni `<script>` inline extensos).
- [x] Conservación del 100% de la funcionalidad previa (Login, Dashboard de candidatos, filtros, búsqueda, carga de CV n8n, modal de detalle, vacantes y base de talentos).
- [x] Centro de Operaciones de Agentes totalmente interactivo y funcional en la interfaz de usuario.
- [x] Validación sintáctica sin errores en todos los módulos JS (`node -c`).
- [x] Documentación completa en `README.md` y `app/README.md`.

---

## ✅ PHASE X COMPLETE
- Lint & Syntax: ✅ Pass (todos los módulos validados con Node)
- Security: ✅ Separación estricta de capas, variables de entorno y sesión controlada
- Architecture: ✅ Monolito 595 líneas desacoplado en capas UI, CSS, Services y Controllers
- Agents Interface: ✅ 6 Agentes con acciones interactivas, consola en vivo y herramientas
- Date: 2026-09-04
