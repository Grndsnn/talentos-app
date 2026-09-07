/**
 * TalentOS - Dashboard & Candidates Controller
 */

import { supabaseService } from '../services/supabase.js';
import { n8nService } from '../services/n8n.js';
import { CONFIG } from '../config.js';
import { telemetry } from '../services/telemetry.js';

export class DashboardController {
    constructor() {
        this.candidates = [];
        this.currentFilter = 'ALL';
        this.searchQuery = '';
        this.currentVacanteId = null;

        // Elements
        this.tableBody = document.getElementById('tableBody');
        this.talentosBody = document.getElementById('talentosBody');
        this.valTotal = document.getElementById('valTotal');
        this.valShortlist = document.getElementById('valShortlist');
        this.valAvg = document.getElementById('valAvg');
        this.valTime = document.getElementById('valTime');
        this.searchInput = document.getElementById('searchInput');
        this.modal = document.getElementById('candidateModal');
        this.modalName = document.getElementById('modalName');
        this.modalBody = document.getElementById('modalBody');

        this.initEvents();
    }

    initEvents() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.applyFilterAndSearch();
            });
        }

        // Close modal on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    async loadCandidates(vacanteId) {
        this.currentVacanteId = vacanteId;
        if (this.tableBody) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: #94a3b8; padding: 30px;">
                        <i class="fa-solid fa-spinner fa-spin"></i> Cargando candidatos desde Supabase...
                    </td>
                </tr>
            `;
        }

        try {
            this.candidates = await supabaseService.getCandidatesByVacante(vacanteId);
            this.updateStats(this.candidates);
            this.applyFilterAndSearch();
        } catch (err) {
            if (this.tableBody) {
                this.tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; color: #e11d48; padding: 24px;">
                            Error al conectar con Supabase: ${err.message}
                        </td>
                    </tr>
                `;
            }
        }
    }

    async loadTalentos() {
        if (!this.talentosBody) return;

        this.talentosBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: #94a3b8; padding: 30px;">
                    <i class="fa-solid fa-spinner fa-spin"></i> Cargando base global de talentos...
                </td>
            </tr>
        `;

        try {
            const data = await supabaseService.getTalentos();

            if (!data || data.length === 0) {
                this.talentosBody.innerHTML = `
                    <tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:30px;">Aún no hay talentos en la base de datos.</td></tr>
                `;
                return;
            }

            this.talentosBody.innerHTML = data.map(c => {
                const score = c.score_hybrid || 0;
                let scoreClass = 'score-green', statusClass = 'status-interview';
                if (score < 60) { scoreClass = 'score-red'; statusClass = 'status-discard'; }
                else if (score < 80) { scoreClass = 'score-amber'; statusClass = 'status-review'; }

                const skills = c.parsed_json?.habilidades || [];
                const tags = skills.slice(0, 3).map(s => `<span class="skill-tag">${s}</span>`).join('');
                const vacanteTitulo = c.vacantes?.titulo || c.vacante_id || 'Sin asignar';

                const safeName = (c.name || 'Candidato').replace(/'/g, "\\'");
                return `
                    <tr>
                        <td>
                            <strong>${c.name}</strong><br>
                            <span style="font-size:11px; color:#64748b;">${c.email || 'Sin correo'}</span>
                        </td>
                        <td><span style="font-weight:500; font-size:12.5px;">${vacanteTitulo}</span></td>
                        <td><span class="score-pill ${scoreClass}">${score}/100</span></td>
                        <td>${tags || '<span style="color:#94a3b8;">Sin registrar</span>'}</td>
                        <td><span class="status-badge ${statusClass}">${c.status || 'REVISAR'}</span></td>
                        <td style="text-align: center;">
                            <button class="btn btn-sm btn-white" style="color: var(--accent-rose); border-color: #fecdd3; padding: 5px 10px;"
                                    onclick="window.app.dashboard.deleteTalento('${c.id}', '${c.email || ''}', '${c.vacante_id || ''}', '${safeName}')"
                                    title="Eliminar este CV y candidato permanentemente">
                                <i class="fa-solid fa-trash-can"></i> Eliminar
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            this.talentosBody.innerHTML = `
                <tr><td colspan="5" style="text-align:center; color:#e11d48; padding:20px;">Error al cargar datos de talentos.</td></tr>
            `;
        }
    }

    updateStats(list) {
        if (!this.valTotal) return;
        const total = list.length;
        const shortlist = list.filter(c => c.status === 'ENTREVISTAR').length;
        const avg = total ? Math.round(list.reduce((acc, c) => acc + (c.score_hybrid || 0), 0) / total) : 0;
        const hours = Math.round(total * 0.4);

        this.valTotal.innerText = total;
        this.valShortlist.innerText = shortlist;
        this.valAvg.innerText = avg;
        this.valTime.innerText = `${hours}h`;
    }

    setFilter(status) {
        this.currentFilter = status;
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-${status}`);
        if (activeBtn) activeBtn.classList.add('active');
        this.applyFilterAndSearch();
    }

    applyFilterAndSearch() {
        let result = [...this.candidates];

        // Status Filter
        if (this.currentFilter !== 'ALL') {
            result = result.filter(c => c.status === this.currentFilter);
        }

        // Search text Filter
        if (this.searchQuery) {
            result = result.filter(c => {
                const nameMatch = c.name?.toLowerCase().includes(this.searchQuery);
                const emailMatch = c.email?.toLowerCase().includes(this.searchQuery);
                const skillsMatch = c.parsed_json?.habilidades?.some(s => s.toLowerCase().includes(this.searchQuery));
                return nameMatch || emailMatch || skillsMatch;
            });
        }

        this.renderTable(result);
    }

    renderTable(list) {
        if (!this.tableBody) return;

        if (list.length === 0) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: #94a3b8; padding: 36px;">
                        No se encontraron candidatos con los criterios actuales.
                    </td>
                </tr>
            `;
            return;
        }

        this.tableBody.innerHTML = list.map((c, index) => {
            const score = c.score_hybrid || 0;
            let scoreClass = 'score-green', statusClass = 'status-interview';

            if (score < 60) {
                scoreClass = 'score-red';
                statusClass = 'status-discard';
            } else if (score < 80) {
                scoreClass = 'score-amber';
                statusClass = 'status-review';
            }

            const skills = c.parsed_json?.habilidades || [];
            const tags = skills.slice(0, 4).map(s => `<span class="skill-tag">${s}</span>`).join('');

            return `
                <tr onclick="window.app.dashboard.openModal(${index})">
                    <td>
                        <strong>${c.name}</strong><br>
                        <span style="font-size: 11px; color: #64748b;">${c.email || 'Sin correo registrado'}</span>
                    </td>
                    <td><span class="score-pill ${scoreClass}">${score}/100</span></td>
                    <td>${tags || '<span style="color:#94a3b8; font-size:12px;">Análisis en curso...</span>'}</td>
                    <td><span class="status-badge ${statusClass}">${c.status || 'REVISAR'}</span></td>
                    <td style="text-align: center;" onclick="event.stopPropagation()">
                        <button class="btn btn-sm btn-white" style="color: var(--accent-rose); border-color: #fecdd3; padding: 4px 8px;" 
                                onclick="window.app.dashboard.deleteCandidate(${index}, event)" title="Eliminar este CV">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openModal(index) {
        const c = this.candidates[index];
        if (!c || !this.modal) return;

        if (this.modalName) this.modalName.innerText = c.name;

        const skills = c.parsed_json?.habilidades || [];
        const allTags = skills.length
            ? skills.map(s => `<span class="skill-tag" style="font-size:12px; padding:4px 10px;">${s}</span>`).join('')
            : '<span style="color:#94a3b8;">No especificadas</span>';
        const exp = c.parsed_json?.anios_experiencia ?? 'No especificada';

        if (this.modalBody) {
            this.modalBody.innerHTML = `
                <div>
                    <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform:uppercase;">CORREO ELECTRÓNICO</span>
                    <p style="font-size: 14.5px; font-weight: 600; color: #0f172a; margin-top:2px;">${c.email || 'No disponible'}</p>
                </div>
                <div style="display: flex; gap: 24px; background:#f8fafc; padding:14px; border-radius:8px; border:1px solid #e2e8f0;">
                    <div>
                        <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform:uppercase;">MATCH SCORE</span>
                        <p style="font-size: 20px; font-weight: 800; color: #2563eb;">${c.score_hybrid || 0}/100</p>
                    </div>
                    <div>
                        <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform:uppercase;">ESTADO IA</span>
                        <p style="font-size: 14px; font-weight: 700; color: #059669; margin-top:4px;">${c.status || 'REVISAR'}</p>
                    </div>
                    <div>
                        <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform:uppercase;">EXPERIENCIA</span>
                        <p style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top:4px;">${exp} años</p>
                    </div>
                </div>
                <div>
                    <span style="font-size: 11px; color: #64748b; font-weight: 700; display: block; margin-bottom: 6px; text-transform:uppercase;">HABILIDADES EXTRAÍDAS POR IA</span>
                    <div style="display:flex; flex-wrap:wrap; gap:4px;">${allTags}</div>
                </div>
                <div>
                    <span style="font-size: 11px; color: #64748b; font-weight: 700; display: block; margin-bottom: 6px; text-transform:uppercase;">ANÁLISIS DEL RECLUTADOR IA</span>
                    <p style="font-size: 13px; color: #334155; line-height: 1.55; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px;">
                        ${c.justificacion || c.parsed_json?.justificacion || 'Sin justificación detallada registrada.'}
                    </p>
                </div>
            `;
        }

        const modalFooter = document.getElementById('candidateModalFooter');
        if (modalFooter) {
            modalFooter.innerHTML = `
                <button onclick="window.app.dashboard.deleteCandidate(${index})" class="btn btn-danger btn-sm">
                    <i class="fa-solid fa-trash-can"></i> Eliminar este CV
                </button>
                <button onclick="window.app.dashboard.closeModal()" class="btn btn-primary btn-sm">Cerrar</button>
            `;
        }

        this.modal.classList.add('active');
    }

    async deleteCandidate(index, event) {
        if (event) event.stopPropagation();

        const c = this.candidates[index];
        if (!c) return;

        const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar permanentemente el CV y datos de "${c.name}"?`);
        if (!confirmDelete) return;

        try {
            telemetry.info(`Iniciando eliminación de candidato: ${c.name}`, 'DASHBOARD');
            await supabaseService.deleteCandidate(c.id, c.email, c.vacante_id);
            this.closeModal();
            alert(`El candidato "${c.name}" ha sido eliminado exitosamente.`);
            await this.loadCandidates(this.currentVacanteId);
        } catch (err) {
            alert(`Error al eliminar candidato: ${err.message}`);
        }
    }

    async deleteTalento(id, email, vacanteId, name) {
        const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar permanentemente de la Base de Talentos a "${name}"?`);
        if (!confirmDelete) return;

        try {
            telemetry.info(`Eliminando talento: ${name} (${id || email})`, 'TALENTOS');
            await supabaseService.deleteCandidate(id, email, vacanteId);
            alert(`El candidato "${name}" ha sido eliminado exitosamente.`);
            await this.loadTalentos();
            if (this.currentVacanteId) {
                await this.loadCandidates(this.currentVacanteId);
            }
        } catch (err) {
            alert(`Error al eliminar candidato: ${err.message}`);
        }
    }

    closeModal() {
        if (this.modal) this.modal.classList.remove('active');
    }

    async insertMockCandidate() {
        const vacanteId = this.currentVacanteId;
        if (!vacanteId) {
            alert('Por favor selecciona una vacante primero');
            return;
        }

        const template = CONFIG.MOCK_CANDIDATES[Math.floor(Math.random() * CONFIG.MOCK_CANDIDATES.length)];
        const mock = {
            ...template,
            vacante_id: vacanteId,
            email: `mock.${Date.now()}@example.com`,
            name: `${template.name} (Demo)`
        };

        telemetry.info(`Inyectando candidato de prueba: ${mock.name}`, 'DASHBOARD');
        try {
            await supabaseService.upsertCandidate(mock);
            telemetry.success('Candidato mock insertado correctamente', 'DASHBOARD');
            await this.loadCandidates(vacanteId);
        } catch (err) {
            telemetry.error(`Fallo al insertar mock: ${err.message}`, 'DASHBOARD');
        }
    }

    async uploadCvFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const btnTextSpan = document.getElementById('uploadBtnText');
        const originalHtml = btnTextSpan ? btnTextSpan.innerHTML : '';
        if (btnTextSpan) {
            btnTextSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analizando CV con IA...';
        }

        // Animación visual del Centro de Agentes (no bloqueante: corre en paralelo al upload real)
        if (window.app.agents) {
            window.app.agents.runCvPipelineSimulation(file.name);
        }

        try {
            const result = await n8nService.uploadCv(file, this.currentVacanteId);
            if (result.success) {
                alert(`¡El archivo ${file.name} fue analizado y enviado a n8n con éxito!`);
                await this.loadCandidates(this.currentVacanteId);
            } else {
                alert(`n8n respondió con error (${result.status}). Verifica el flujo.`);
            }
        } catch (err) {
            alert(`Error de red al conectar con n8n: ${err.message}`);
        } finally {
            if (btnTextSpan) btnTextSpan.innerHTML = originalHtml;
            event.target.value = '';
        }
    }
    async uploadMultipleCvs(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const btnTextSpan = document.getElementById('uploadMultipleBtnText');
        const originalHtml = btnTextSpan ? btnTextSpan.innerHTML : '';
        if (btnTextSpan) {
            btnTextSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando varios CVs...';
        }

        // Animación visual del Centro de Agentes (no bloqueante: corre en paralelo al upload real)
        if (window.app.agents) {
            window.app.agents.runCvPipelineSimulation(`${files.length} CV(s)`);
        }

        let successCount = 0;
        let failCount = 0;

        for (const file of files) {
            try {
                const result = await n8nService.uploadCv(file, this.currentVacanteId);
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
                console.error(`Error uploading ${file.name}:`, err);
            }
        }

        alert(`Subida completada. Éxitos: ${successCount}, Fallos: ${failCount}.`);
        await this.loadCandidates(this.currentVacanteId);

        if (btnTextSpan) btnTextSpan.innerHTML = originalHtml;
        event.target.value = '';
    }

}