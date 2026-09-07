/**
 * TalentOS - Configuration & Environment Constants
 */

export const CONFIG = {
    // Supabase Credentials
    SUPABASE: {
        URL: 'https://lfagfjlfpznfduesnwrw.supabase.co',
        ANON_KEY: 'sb_publishable_up_T1LnRMRXAMdWVrbzXxw_bzE1UXh-',
        SERVICE_KEY: 'sb_secret_473Zjscmia3NkSessHmztw__0b-TSx3',
        KEY: 'sb_secret_473Zjscmia3NkSessHmztw__0b-TSx3'
    },

    // n8n Webhook Configuration
    N8N: {
        CV_WEBHOOK_URL: 'https://n8n-david.automindanalytics.com/webhook/cv-webhook'
    },

    // Demo Auth Credentials
    AUTH: {
        ADMIN_USER: 'admin',
        ADMIN_PASS: 'admin',
        SESSION_KEY: 'talentos_auth'
    },

    // Agents Registry & Personas
    AGENTS: {
        orchestrator: {
            id: 'orchestrator',
            name: 'TalentScout IA',
            title: 'Coordinador de Selección',
            icon: 'fa-sitemap',
            color: '#2563eb',
            description: 'Coordina el análisis integral y gestiona la entrada de hojas de vida.'
        },
        backend: {
            id: 'backend',
            name: 'Parser & Matcher',
            title: 'Extractor de Habilidades',
            icon: 'fa-server',
            color: '#059669',
            description: 'Extrae perfiles, parsea PDFs y calcula el puntaje de coincidencia (Match Score).'
        },
        archaeologist: {
            id: 'archaeologist',
            name: 'Profile Optimizer',
            title: 'Optimizador de Perfil',
            icon: 'fa-landmark',
            color: '#d97706',
            description: 'Especialista en estructurar historiales laborales y normalizar competencias.'
        },
        debugger: {
            id: 'debugger',
            name: 'Bias Auditor',
            title: 'Auditor de Equidad',
            icon: 'fa-bug',
            color: '#e11d48',
            description: 'Verifica la integridad de los datos y asegura un filtrado libre de sesgos.'
        },
        planner: {
            id: 'planner',
            name: 'Workflow Planner',
            title: 'Planificador de Entrevistas',
            icon: 'fa-diagram-project',
            color: '#0891b2',
            description: 'Organiza los estados del proceso y los hitos de contratación.'
        },
        test: {
            id: 'test',
            name: 'Quality Assessor',
            title: 'Validador de Candidatos',
            icon: 'fa-vial-circle-check',
            color: '#7c3aed',
            description: 'Valida que la puntuación y las métricas de IA cumplan con los requisitos.'
        }
    },

    // Synthetic Mock Candidates for Testing
    MOCK_CANDIDATES: [
        {
            name: 'Carlos Mendoza',
            email: 'carlos.m@example.com',
            score_hybrid: 86,
            status: 'ENTREVISTAR',
            justificacion: 'Sólida experiencia con Python, AWS y Docker. Excelente match con requisitos clave.',
            parsed_json: { habilidades: ['Python', 'AWS', 'Docker', 'FastAPI'], anios_experiencia: 4 }
        },
        {
            name: 'Laura Fernández',
            email: 'laura.f@example.com',
            score_hybrid: 94,
            status: 'ENTREVISTAR',
            justificacion: 'Perfil Senior Fullstack con liderazgo técnico en arquitecturas cloud y PostgreSQL.',
            parsed_json: { habilidades: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Kubernetes'], anios_experiencia: 7 }
        },
        {
            name: 'Javier Restrepo',
            email: 'j.restrepo@example.com',
            score_hybrid: 72,
            status: 'REVISAR',
            justificacion: 'Buen conocimiento técnico pero con experiencia algo justa para nivel senior.',
            parsed_json: { habilidades: ['JavaScript', 'HTML/CSS', 'Vue.js', 'Git'], anios_experiencia: 2 }
        },
        {
            name: 'Mariana Gómez',
            email: 'mariana.g@example.com',
            score_hybrid: 45,
            status: 'DESCARTAR',
            justificacion: 'Faltan habilidades clave requeridas en el perfil técnico de la vacante.',
            parsed_json: { habilidades: ['Excel', 'Copywriting', 'Trello'], anios_experiencia: 1 }
        }
    ]
};
