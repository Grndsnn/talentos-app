/**
 * TalentOS - Agent Operations Center Controller
 * Galería interactiva y simulación visual de los 6 agentes.
 */

import { CONFIG } from '../config.js';
import { supabaseService } from '../services/supabase.js';
import { n8nService } from '../services/n8n.js';

export class AgentsController {
    constructor() {
        this.selectedAgent = 'orchestrator';
        this.initUI();
    }

    initUI() {
        this.container = document.getElementById('viewAgentes');
        this.cardsContainer = document.getElementById('agentsCardsGrid');
        this.topologyContainer = document.getElementById('agentVisualTopologyContainer');
        this.dashboardStripContainer = document.getElementById('dashboardAgentStripContainer');
        this.actionsContainer = document.getElementById('agentActionsContainer');

        const consolePanel = document.querySelector('.agent-console-panel');
        if (consolePanel) consolePanel.style.display = 'none';

        const controlsPanel = document.querySelector('.agent-controls-panel');
        if (controlsPanel) controlsPanel.style.display = 'none';

        const workspace = document.querySelector('.agent-workspace');
        if (workspace) {
            workspace.style.display = 'block';
            workspace.style.gridTemplateColumns = 'none';
        }

        this.renderAgentCards();
    }

    renderAgentCards() {
        if (!this.cardsContainer) return;
        const agents = Object.values(CONFIG.AGENTS);

        this.cardsContainer.innerHTML = agents.map(agent => {
            const fallbackIcon = `<i class="fa-solid ${agent.icon}"></i>`;
            return `
            <div class="agent-summary-card" data-color="${agent.color}" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); transition: border-color 0.2s, box-shadow 0.2s; cursor:pointer;">
                <div style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 2px solid ${agent.color}55; background: #090d16; flex-shrink: 0;">
                    <img src="${agent.avatar}" alt="${agent.name}" width="48" height="48" style="object-fit: contain; border-radius: 50%;" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display:none; width:48px; height:48px; border-radius:50%; background:${agent.color}; align-items:center; justify-content:center; color:#fff; font-size:18px;">${fallbackIcon}</div>
                </div>
                <div>
                    <div style="font-weight: 700; font-size: 13.5px; color: #0f172a;">🤖 ${agent.name}</div>
                    <div style="font-size: 11.5px; color: #64748b; margin-top: 1px;">${agent.title}</div>
                </div>
            </div>`;
        }).join('');

        // Hover effects via JS (avoids inline quote escaping issues)
        this.cardsContainer.querySelectorAll('.agent-summary-card').forEach(card => {
            const color = card.dataset.color;
            card.addEventListener('mouseenter', () => {
                card.style.borderColor = color;
                card.style.boxShadow = `0 4px 12px rgba(0,0,0,0.1)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.borderColor = '#e2e8f0';
                card.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)';
            });
        });
    }

    triggerAgentAction(agentId) {
        const agent = CONFIG.AGENTS[agentId];
        if (agentId === 'test') {
            window.app?.dashboard?.insertMockCandidate();
            alert(`✨ ¡El marcianito ${agent.name} ha generado e inyectado un candidato de prueba con éxito!`);
        } else {
            alert(`✨ ¡Hola! Soy el marcianito ${agent.name} (${agent.title}). ¡Todo opera a la perfección en mi módulo!`);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Solo ejecuta la animación visual de los 6 agentes.
    // No sube el archivo (eso ya lo hace dashboard.js -> n8nService.uploadCv).
    async runCvPipelineSimulation(fileName) {
        const steps = [
            { id: 'orchestrator', text: 'Coordinando...' },
            { id: 'backend', text: 'Extrayendo PDF...' },
            { id: 'archaeologist', text: 'Optimizando perfil...' },
            { id: 'debugger', text: 'Auditando equidad...' },
            { id: 'planner', text: 'Organizando flujo...' },
            { id: 'test', text: 'Validando score...' }
        ];

        for (const step of steps) {
            const badgeText = document.getElementById(`badge-text-${step.id}`);
            const dot = document.getElementById(`dot-${step.id}`);
            const card = document.getElementById(`card-node-${step.id}`);

            if (badgeText) badgeText.innerText = step.text;
            if (dot) {
                dot.style.background = '#f59e0b';
                dot.style.boxShadow = '0 0 8px #f59e0b';
            }
            if (card) card.style.borderColor = '#f59e0b';

            await this.delay(600);

            if (dot) {
                dot.style.background = '#10b981';
                dot.style.boxShadow = '0 0 6px #10b981';
            }
            if (badgeText) badgeText.innerText = 'Completado';
            if (card) card.style.borderColor = '#334155';
        }

        const agentKeys = Object.keys(CONFIG.AGENTS);
        agentKeys.forEach(k => {
            const badgeText = document.getElementById(`badge-text-${k}`);
            if (badgeText) badgeText.innerText = (k === 'orchestrator') ? '📄 Subir CV aquí' : 'Activo y Listo';
        });
    }

    async handleAgentCvUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const steps = [
            { id: 'orchestrator', text: 'Coordinando...' },
            { id: 'backend', text: 'Extrayendo PDF...' },
            { id: 'archaeologist', text: 'Optimizando perfil...' },
            { id: 'debugger', text: 'Auditando equidad...' },
            { id: 'planner', text: 'Organizando flujo...' },
            { id: 'test', text: 'Validando score...' }
        ];

        const simulationPromise = async () => {
            for (const step of steps) {
                const badgeText = document.getElementById(`badge-text-${step.id}`);
                const dot = document.getElementById(`dot-${step.id}`);
                const card = document.getElementById(`card-node-${step.id}`);

                if (badgeText) badgeText.innerText = step.text;
                if (dot) {
                    dot.style.background = '#f59e0b';
                    dot.style.boxShadow = '0 0 8px #f59e0b';
                }
                if (card) card.style.borderColor = '#f59e0b';

                await this.delay(600);

                if (dot) {
                    dot.style.background = '#10b981';
                    dot.style.boxShadow = '0 0 6px #10b981';
                }
                if (badgeText) badgeText.innerText = 'Completado';
                if (card) card.style.borderColor = '#334155';
            }
        };

        try {
            const vacanteId = window.app?.dashboard?.currentVacanteId || 'REQ-2026-01';
            await Promise.all([
                simulationPromise(),
                n8nService.uploadCv(file, vacanteId)
            ]);

            alert(`✨ ¡El equipo de marcianitos analizó y procesó con éxito el archivo "${file.name}"!`);
        } catch (err) {
            alert(`✨ ¡Simulación visual completada para el archivo "${file.name}"!`);
        } finally {
            const agentKeys = Object.keys(CONFIG.AGENTS);
            agentKeys.forEach(k => {
                const badgeText = document.getElementById(`badge-text-${k}`);
                if (badgeText) badgeText.innerText = (k === 'orchestrator') ? '📄 Subir CV aquí' : 'Activo y Listo';
            });
            event.target.value = '';
        }
    }
}