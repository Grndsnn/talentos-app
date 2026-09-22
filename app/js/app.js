/**
 * TalentOS - Main Application Bootstrap
 */

import { AuthController } from './controllers/auth.js';
import { VacantesController } from './controllers/vacantes.js';
import { DashboardController } from './controllers/dashboard.js';
import { AnalyticsController } from './controllers/analytics.js';
import { AgentsController } from './controllers/agents.js';
import { telemetry } from './services/telemetry.js';

class App {
    constructor() {
        this.currentView = 'dashboard';
        this.auth = null;
        this.vacantes = null;
        this.dashboard = null;
        this.analytics = null;
        this.agents = null;
    }

    async init() {
        telemetry.info('Iniciando TalentOS en modo modular...', 'SYSTEM');

        // 1. Initialize Dashboard (Screening) Controller
        this.dashboard = new DashboardController();

        // 2. Initialize Analytics (Executive Stats) Controller
        this.analytics = new AnalyticsController();

        // 3. Initialize Vacantes Controller
        this.vacantes = new VacantesController((selectedVacanteId) => {
            this.dashboard.loadCandidates(selectedVacanteId);
        });

        // 4. Initialize Agents Controller
        this.agents = new AgentsController();

        // 5. Initialize Auth Controller
        this.auth = new AuthController(async () => {
            await this.onUserLoggedIn();
        });

        // 6. Setup Navigation Links
        this.setupNavigation();

        telemetry.success('TalentOS modular cargado y listo', 'SYSTEM');
    }

    async onUserLoggedIn() {
        // Load initial vacancies, candidates & analytics
        const vacantesList = await this.vacantes.loadVacantes();
        if (vacantesList.length > 0) {
            await this.dashboard.loadCandidates(vacantesList[0].id);
        }
        await this.analytics.loadAnalytics();
    }

    setupNavigation() {
        const navMap = {
            'nav-dashboard': 'dashboard',
            'nav-screening': 'screening',
            'nav-vacantes': 'vacantes',
            'nav-nueva-vacante': 'nuevaVacante',
            'nav-talentos': 'talentos',
            'nav-agentes': 'agentes'
        };

        Object.entries(navMap).forEach(([navId, viewName]) => {
            const el = document.getElementById(navId);
            if (el) {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchView(viewName);
                });
            }
        });

        // Conectar botón del Header "Nueva Vacante"
        const btnHeaderNuevaVacante = document.getElementById('btnNuevaVacante');
        if (btnHeaderNuevaVacante) {
            btnHeaderNuevaVacante.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchView('nuevaVacante');
            });
        }
    }

    switchView(view) {
        this.currentView = view;
        const views = ['dashboard', 'screening', 'vacantes', 'nuevaVacante', 'talentos', 'agentes'];

        views.forEach(v => {
            const viewEl = document.getElementById(`view${v.charAt(0).toUpperCase() + v.slice(1)}`);
            let navId = `nav-${v}`;
            if (v === 'nuevaVacante') navId = 'nav-nueva-vacante';
            const navEl = document.getElementById(navId);

            if (viewEl) viewEl.style.display = (v === view) ? 'flex' : 'none';
            if (navEl) navEl.classList.toggle('active', v === view);
        });

        // View specific refresh triggers
        if (view === 'dashboard') {
            this.analytics.loadAnalytics();
        } else if (view === 'screening') {
            const curVacId = this.vacantes.getCurrentVacanteId();
            if (curVacId && (!this.dashboard.candidates || this.dashboard.candidates.length === 0)) {
                this.dashboard.loadCandidates(curVacId);
            }
        } else if (view === 'vacantes') {
            this.vacantes.renderVacantesGrid();
        } else if (view === 'nuevaVacante') {
            const inputTitulo = document.getElementById('nvTitulo');
            if (inputTitulo) inputTitulo.focus();
        } else if (view === 'talentos') {
            this.dashboard.loadTalentos();
        } else if (view === 'agentes') {
            if (this.agents && this.agents.selectedAgent === 'debugger') {
                this.agents.streamTelemetry();
            }
        }
    }

    irAVacante(vacanteId) {
        this.vacantes.setVacante(vacanteId);
        this.switchView('screening');
        this.dashboard.loadCandidates(vacanteId);
    }

    irAAgentes(agentId) {
        this.switchView('agentes');
        if (this.agents && agentId) {
            this.agents.selectAgent(agentId);
        }
    }
}

// Global initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});
