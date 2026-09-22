# TalentOS — AI Recruiting Intelligence OS

> Plataforma corporativa de evaluación, filtrado y analítica de candidatos con Inteligencia Artificial, arquitectura multi-inquilino y automatización avanzada.

---

## 🌟 Características Principales

1. **Centro de Inteligencia & Dashboard Estadístico:**
   - Métricas macro en tiempo real: total de candidatos, vacantes activas, ratio de shortlist y match score promedio.
   - Embudo de conversión del pipeline (Entrevistar, Revisar, Descartar, Pendientes).
   - Radar de competencias más demandadas en el mercado laboral y gaps críticos detectados en postulantes.
   - Rendimiento comparativo por vacante.

2. **Evaluación Autónoma de CVs con IA:**
   - Extracción estructurada de competencias técnicas, años de experiencia, datos de contacto y nivel de afinidad.
   - Matching multi-vacante: reubicación inteligente de candidatos hacia vacantes alternativas donde su perfil encaja mejor.
   - Puntuación híbrida (0 a 100) y justificación ejecutiva del reclutador IA.

3. **Gestión Dinámica de Vacantes:**
   - Creación en pestaña integrada con análisis en vivo de la descripción del cargo.
   - Extracción interactiva de habilidades requeridas según el nicho y área de la empresa.
   - Eliminación en cascada segura con confirmación previa.

4. **Seguridad y Aislamiento Multi-Tenant (RLS):**
   - Políticas de Row-Level Security en Supabase para aislamiento estricto por reclutador o empresa.
   - Autenticación segura con roles y perfiles.

5. **Base Global de Talentos:**
   - Repositorio unificado con búsqueda predictiva, filtros multicriterio y selección masiva para depuración.

---

## 🏗️ Arquitectura Modular (`app/`)

```
app/
├── index.html                   # Shell principal de la plataforma
├── server.js                    # Servidor local Node.js
├── css/                         # Sistema de diseño desacoplado
│   ├── main.css                 # Variables, tokens y reset
│   ├── layout.css               # Flexbox responsive y scroll fluido
│   ├── dashboard.css            # Tablas, tarjetas y componentes de métricas
│   └── agents.css               # Estilos del Centro de Operaciones
├── js/
│   ├── config.js                # Parámetros centralizados
│   ├── app.js                   # Orquestador del router y ciclo de vida
│   ├── services/
│   │   ├── supabase.js          # Acceso a base de datos y Storage
│   │   ├── n8n.js               # Disparador del motor de IA
│   │   └── telemetry.js         # Logging y monitorización en tiempo real
│   └── controllers/
│       ├── auth.js              # Gestión de sesiones y multi-tenant
│       ├── analytics.js         # Métricas ejecutivas y pipeline funnel
│       ├── dashboard.js         # Screening de CVs y base de talentos
│       ├── vacantes.js          # Formularios y catálogo de puestos
│       └── agents.js            # Consola y monitoreo del sistema
└── supabase_security_and_multitenancy.sql  # Definición de políticas RLS y tablas
```

---

## 🚀 Despliegue Local

```bash
# Iniciar el servidor local
node app/server.js
```

Abre tu navegador en `http://localhost:5500/` para ingresar a la plataforma.
