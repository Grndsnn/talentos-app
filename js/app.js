/**
 * TalentOS - Main Application Bootstrap
 */

import { AuthController } from './controllers/auth.js';
import { VacantesController } from './controllers/vacantes.js';
import { DashboardController } from './controllers/dashboard.js';
import { AgentsController } from './controllers/agents.js';
import { telemetry } from './services/telemetry.js';

class App {
    constructor() {
        this.currentView = 'dashboard';
        this.auth = null;
        this.vacantes = null;
        this.dashboard = null;
        this.agents = null;
    }

    async init() {
        telemetry.info('Iniciando TalentOS en modo modular...', 'SYSTEM');

        // 1. Initialize Dashboard Controller
        this.dashboard = new DashboardController();

        // 2. Initialize Vacantes Controller
        this.vacantes = new VacantesController((selectedVacanteId) => {
            this.dashboard.loadCandidates(selectedVacanteId);
        });

        // 3. Initialize Agents Controller
        this.agents = new AgentsController();

        // 4. Initialize Auth Controller
        this.auth = new AuthController(async () => {
            await this.onUserLoggedIn();
        });

        // 5. Setup Navigation Links
        this.setupNavigation();

        telemetry.success('TalentOS modular cargado y listo', 'SYSTEM');
    }

    async onUserLoggedIn() {
        // Load initial vacancies & candidates
        const vacantesList = await this.vacantes.loadVacantes();
        if (vacantesList.length > 0) {
            await this.dashboard.loadCandidates(vacantesList[0].id);
        }
    }

    setupNavigation() {
        const navMap = {
            'nav-dashboard': 'dashboard',
            'nav-vacantes': 'vacantes',
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
    }

    switchView(view) {
        this.currentView = view;
        const views = ['dashboard', 'vacantes', 'talentos', 'agentes'];

        views.forEach(v => {
            const viewEl = document.getElementById(`view${v.charAt(0).toUpperCase() + v.slice(1)}`);
            const navEl = document.getElementById(`nav-${v}`);

            if (viewEl) viewEl.style.display = (v === view) ? 'flex' : 'none';
            if (navEl) navEl.classList.toggle('active', v === view);
        });

        // View specific refresh triggers
        if (view === 'vacantes') {
            this.vacantes.renderVacantesGrid();
        } else if (view === 'talentos') {
            this.dashboard.loadTalentos();
        } else if (view === 'agentes') {
            // Keep agent center refreshed
            if (this.agents && this.agents.selectedAgent === 'debugger') {
                this.agents.streamTelemetry();
            }
        }
    }

    irAVacante(vacanteId) {
        this.vacantes.setVacante(vacanteId);
        this.switchView('dashboard');
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
