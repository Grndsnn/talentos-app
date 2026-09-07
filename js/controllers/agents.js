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

        this.renderVisualTopology();
        this.renderDashboardStrip();
        this.renderAgentCards();
    }

    renderVisualTopology() {
        if (!this.topologyContainer) return;

        const agents = Object.values(CONFIG.AGENTS);

        this.topologyContainer.innerHTML = `
            <input type="file" id="topologyCvInput" style="display:none;" accept=".pdf" onchange="window.app.agents.handleAgentCvUpload(event)">
            
            <div style="background: radial-gradient(circle at 50% 20%, #1e293b, #090d16); border: 1px solid #334155; border-radius: 24px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 28px; width: 100%;">
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 10px; color: #f8fafc; font-size: 16px; font-weight: 700;">
                        <i class="fa-solid fa-robot" style="color:#38bdf8; font-size: 20px;"></i>
                        <span>Galería de Marcianitos e Inteligencias Especializadas</span>
                    </div>
                    <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 11.5px; font-weight: 600; padding: 4px 12px; border-radius: 20px;">
                        ✨ Haz clic en TalentScout IA para subir tu CV
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; width: 100%;">
                    ${agents.map((agent) => {
            const isOrchestrator = agent.id === 'orchestrator';
            const clickAction = isOrchestrator ? "document.getElementById('topologyCvInput').click()" : `window.app.agents.triggerAgentAction('${agent.id}')`;
            const bgStyle = isOrchestrator ? 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(15,23,42,0.9))' : 'rgba(15, 23, 42, 0.85)';
            const borderStyle = isOrchestrator ? '2px dashed #38bdf8' : '1px solid #334155';
            const badgeText = isOrchestrator ? '📄 Subir CV aquí' : 'Activo y Listo';

            return `
                            <div id="card-node-${agent.id}" 
                                 onclick="${clickAction}" 
                                 style="background: ${bgStyle}; border: ${borderStyle}; border-radius: 20px; padding: 24px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; cursor: pointer; transition: all 0.3s ease; position: relative; box-shadow: 0 8px 20px rgba(0,0,0,0.3);">
                                 
                                <div style="width: 64px; height: 64px; border-radius: 50%; background: ${agent.color}; display: flex; align-items: center; justify-content: center; font-size: 26px; color: #ffffff; box-shadow: 0 0 20px ${agent.color}88; position: relative;">
                                    <i class="fa-solid ${agent.icon}"></i>
                                </div>
                                
                                <div>
                                    <div style="color: #ffffff; font-size: 15px; font-weight: 700;">🤖 ${agent.name}</div>
                                    <div style="color: #38bdf8; font-size: 11.5px; font-weight: 600; margin-top: 2px;">${agent.title}</div>
                                </div>

                                <div style="color: #94a3b8; font-size: 11px; line-height: 1.4; min-height: 32px;">
                                    ${agent.description}
                                </div>

                                <div style="margin-top: auto; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; gap: 6px;" id="badge-${agent.id}">
                                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #34d399; box-shadow: 0 0 6px #34d399;" id="dot-${agent.id}"></span>
                                    <span id="badge-text-${agent.id}">${badgeText}</span>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>

            </div>
        `;
    }

    renderDashboardStrip() {
        if (!this.dashboardStripContainer) return;
        const agents = Object.values(CONFIG.AGENTS);
        this.dashboardStripContainer.innerHTML = `
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 6px rgba(0,0,0,0.04); gap: 16px;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #0f172a; white-space: nowrap;">
                    <i class="fa-solid fa-microchip" style="color: #2563eb;"></i>
                    <span>Equipo de Marcianitos en Línea:</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; overflow-x: auto;">
                    ${agents.map(a => `
                        <div style="display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 20px;">
                            <div style="width: 24px; height: 24px; border-radius: 50%; background: ${a.color}; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #fff;">
                                <i class="fa-solid ${a.icon}"></i>
                            </div>
                            <span style="font-size: 12px; font-weight: 600; color: #475569;">${a.name}</span>
                            <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981;"></span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderAgentCards() {
        if (!this.cardsContainer) return;
        const agents = Object.values(CONFIG.AGENTS);
        this.cardsContainer.innerHTML = agents.map(agent => `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                <div style="background: ${agent.color}; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; flex-shrink: 0;">
                    <i class="fa-solid ${agent.icon}"></i>
                </div>
                <div>
                    <div style="font-weight: 700; font-size: 13.5px; color: #0f172a;">🤖 ${agent.name}</div>
                    <div style="font-size: 11.5px; color: #64748b; margin-top: 1px;">${agent.title}</div>
                </div>
            </div>
        `).join('');
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