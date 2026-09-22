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
        this.valGaps = document.getElementById('valGaps');
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
        if (!vacanteId) {
            this.candidates = [];
            this.updateStats([]);
            if (this.tableBody) {
                this.tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; color: #94a3b8; padding: 30px;">
                            No hay ninguna vacante seleccionada o activa.
                        </td>
                    </tr>
                `;
            }
            return;
        }

        if (this.tableBody) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: #94a3b8; padding: 30px;">
                        <i class="fa-solid fa-spinner fa-spin"></i> Cargando expedientes de candidatos...
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
                            Error al cargar candidatos: ${err.message}
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
                <td colspan="7" style="text-align: center; color: #94a3b8; padding: 30px;">
                    <i class="fa-solid fa-spinner fa-spin"></i> Cargando base global de talentos...
                </td>
            </tr>
        `;

        try {
            const data = await supabaseService.getTalentos();

            if (!data || data.length === 0) {
                this.talentosBody.innerHTML = `
                    <tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:30px;">Aún no hay talentos en la base de datos.</td></tr>
                `;
                return;
            }

            this.talentosBody.innerHTML = data.map((c, index) => {
                const score = c.score_hybrid || 0;
                let statusClass = 'status-interview';
                if (score < 60) statusClass = 'status-discard';
                else if (score < 80) statusClass = 'status-review';

                const skills = c.parsed_json?.skills_clave || c.parsed_json?.habilidades || [];
                const tags = skills.slice(0, 3).map(s => `<span class="skill-tag">${s}</span>`).join('');
                const vacanteTitulo = c.vacantes?.titulo || c.vacante_id || 'Sin asignar';
                const isReassigned = c.parsed_json?.vacante_original_id && c.parsed_json?.mejor_vacante_id && c.parsed_json.vacante_original_id !== c.parsed_json.mejor_vacante_id;
                const reubicadoBadge = isReassigned 
                    ? `<br><span style="font-size:10.5px; color:#1d4ed8; background:#dbeafe; padding:2px 6px; border-radius:4px; font-weight:600; display:inline-block; margin-top:3px;" title="Candidato reubicado a su perfil ideal"><i class="fa-solid fa-wand-magic-sparkles"></i> Match Ideal Reubicado</span>`
                    : '';
                const safeName = (c.name || 'Candidato').replace(/'/g, "\\'");

                return `
                    <tr>
                        <td style="text-align:center; padding:10px; width:44px;" onclick="event.stopPropagation()">
                            <input type="checkbox"
                                   class="talento-chk"
                                   data-id="${c.id}"
                                   data-email="${c.email || ''}"
                                   data-vacante="${c.vacante_id || ''}"
                                   data-name="${safeName}"
                                   onchange="window.app.dashboard.updateTalentosSelection()"
                                   style="width:15px; height:15px; cursor:pointer; accent-color:#1e3a8a;">
                        </td>
                        <td>
                            <div class="candidate-cell">
                                <div class="candidate-avatar">${(c.name || '?')[0].toUpperCase()}</div>
                                <div>
                                    <strong>${c.name}</strong><br>
                                    <span style="font-size:11px; color:#64748b;">${c.email || 'Sin correo'}</span>
                                </div>
                            </div>
                        </td>
                        <td><span style="font-weight:500; font-size:12.5px;">${vacanteTitulo}</span>${reubicadoBadge}</td>
                        <td style="text-align:center;">${this.buildScoreWheel(score)}</td>
                        <td>${tags || '<span style="color:#94a3b8;">Sin registrar</span>'}</td>
                        <td>${this.buildGapsCell(c)}</td>
                        <td><span class="status-badge ${statusClass}">${c.status || 'REVISAR'}</span></td>
                        <td>
                            <div class="action-btns">
                                <button class="action-btn action-btn--email"
                                        onclick="window.app.dashboard.sendEmailById('${c.email || ''}', '${safeName}')"
                                        title="Enviar correo">
                                    <i class="fa-solid fa-envelope"></i>
                                </button>
                                <button class="action-btn action-btn--msg"
                                        onclick="window.app.dashboard.sendMessageById('${safeName}')"
                                        title="Enviar mensaje">
                                    <i class="fa-solid fa-comment"></i>
                                </button>
                                <button class="action-btn action-btn--del"
                                        onclick="window.app.dashboard.deleteTalento('${c.id}', '${c.email || ''}', '${c.vacante_id || ''}', '${safeName}')"
                                        title="Eliminar">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Reset select-all state on fresh load
            const selAll = document.getElementById('talentosSelectAll');
            if (selAll) selAll.checked = false;
            this.updateTalentosSelection();

        } catch (err) {
            this.talentosBody.innerHTML = `
                <tr><td colspan="8" style="text-align:center; color:#e11d48; padding:20px;">Error al cargar datos de talentos.</td></tr>
            `;
        }
    }

    // Toggle all checkboxes in talentos table
    toggleSelectAllTalentos(checked) {
        document.querySelectorAll('.talento-chk').forEach(chk => { chk.checked = checked; });
        this.updateTalentosSelection();
    }

    // Update bulk-delete button state and counter label
    updateTalentosSelection() {
        const checked = document.querySelectorAll('.talento-chk:checked');
        const total   = document.querySelectorAll('.talento-chk');
        const btn     = document.getElementById('btnDeleteSelected');
        const counter = document.getElementById('talentosSelCount');
        const selAll  = document.getElementById('talentosSelectAll');

        const n = checked.length;

        if (counter) {
            counter.innerHTML = n > 0
                ? `<i class="fa-solid fa-circle-check" style="color:#e11d48;"></i> <strong>${n}</strong> candidato${n > 1 ? 's' : ''} seleccionado${n > 1 ? 's' : ''}`
                : '<i class="fa-solid fa-users" style="color:#2563eb;"></i> Selecciona candidatos para eliminar';
        }
        if (btn) {
            btn.disabled = n === 0;
            btn.style.opacity = n === 0 ? '0.45' : '1';
        }
        // Indeterminate state for select-all checkbox
        if (selAll) {
            selAll.indeterminate = n > 0 && n < total.length;
            selAll.checked = n > 0 && n === total.length;
        }
    }

    // Delete all selected talentos
    async deleteSelectedTalentos() {
        const checked = document.querySelectorAll('.talento-chk:checked');
        if (!checked.length) return;

        const names = Array.from(checked).map(chk => chk.dataset.name).join(', ');
        const confirmDelete = confirm(`¿Eliminar permanentemente ${checked.length} candidato${checked.length > 1 ? 's' : ''} de la Base de Talentos?\n\n${names}`);
        if (!confirmDelete) return;

        const btn = document.getElementById('btnDeleteSelected');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Eliminando...'; }

        let errors = 0;
        for (const chk of checked) {
            try {
                await supabaseService.deleteCandidate(chk.dataset.id, chk.dataset.email, chk.dataset.vacante);
            } catch {
                errors++;
            }
        }

        if (errors > 0) alert(`Se eliminaron ${checked.length - errors} candidatos. ${errors} fallaron.`);
        else alert(`${checked.length} candidato${checked.length > 1 ? 's' : ''} eliminado${checked.length > 1 ? 's' : ''} exitosamente.`);

        await this.loadTalentos();
        if (this.currentVacanteId) await this.loadCandidates(this.currentVacanteId);
    }


    // Builds circular SVG score wheel
    buildScoreWheel(score) {
        const radius = 26;
        const circumference = 2 * Math.PI * radius;
        const pct = Math.min(Math.max(score, 0), 100);
        const offset = circumference - (pct / 100) * circumference;

        let color, trackColor;
        if (pct >= 80) {
            color = '#10b981'; trackColor = '#d1fae5';
        } else if (pct >= 60) {
            color = '#f59e0b'; trackColor = '#fef3c7';
        } else {
            color = '#ef4444'; trackColor = '#fee2e2';
        }

        return `
            <div class="score-wheel-wrap">
                <svg width="66" height="66" viewBox="0 0 66 66">
                    <circle cx="33" cy="33" r="${radius}" fill="none" stroke="${trackColor}" stroke-width="6"/>
                    <circle cx="33" cy="33" r="${radius}" fill="none" stroke="${color}" stroke-width="6"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                        stroke-linecap="round" transform="rotate(-90 33 33)"/>
                </svg>
                <span class="score-wheel-num" style="color:${color};">${pct}</span>
            </div>`;
    }

    // Builds gaps cell HTML from candidate data
    buildGapsCell(c) {
        const gaps = c.parsed_json?.gaps || c.gaps || [];
        const hasCritical = (c.score_hybrid || 0) < 60;

        if (!gaps.length && !hasCritical) {
            return `<span class="gap-none"><i class="fa-solid fa-circle-check"></i> Ninguno crítico</span>`;
        }
        if (hasCritical && !gaps.length) {
            return `<span class="gap-warn"><i class="fa-solid fa-triangle-exclamation"></i> Score bajo</span>`;
        }
        return gaps.slice(0, 2).map(g =>
            `<span class="gap-tag"><i class="fa-solid fa-xmark"></i> ${g}</span>`
        ).join('');
    }

    updateStats(list) {
        if (!this.valTotal) return;
        const total = list.length;
        const shortlist = list.filter(c => c.status === 'ENTREVISTAR').length;
        const evaluated = list.filter(c => (c.score_hybrid || 0) > 0);
        const avg = evaluated.length ? Math.round(evaluated.reduce((acc, c) => acc + (c.score_hybrid || 0), 0) / evaluated.length) : 0;
        const gaps = list.filter(c => c.status === 'REVISAR' || ((c.score_hybrid || 0) > 0 && (c.score_hybrid || 0) < 60)).length;

        this.valTotal.innerText = total;
        this.valShortlist.innerText = shortlist;
        this.valAvg.innerText = avg;
        if (this.valGaps) this.valGaps.innerText = gaps;
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
                const skillsArr = c.parsed_json?.skills_clave || c.parsed_json?.habilidades || [];
                const skillsMatch = skillsArr.some(s => s.toLowerCase().includes(this.searchQuery));
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
            let statusClass = 'status-interview';
            if (score < 60) statusClass = 'status-discard';
            else if (score < 80) statusClass = 'status-review';

            const skills = c.parsed_json?.skills_clave || c.parsed_json?.habilidades || [];
            const tags = skills.slice(0, 3).map(s => `<span class="skill-tag">${s}</span>`).join('');
            const safeEmail = (c.email || '').replace(/'/g, "\\'");
            const safeName = (c.name || '').replace(/'/g, "\\'");

            return `
                <tr onclick="window.app.dashboard.openModal(${index})">
                    <td>
                        <div class="candidate-cell">
                            <div class="candidate-avatar">${(c.name || '?')[0].toUpperCase()}</div>
                            <div>
                                <strong>${c.name}</strong><br>
                                <span style="font-size: 11px; color: #64748b;">${c.email || 'Sin correo'}</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align:center;">${this.buildScoreWheel(score)}</td>
                    <td>${tags || '<span style="color:#94a3b8; font-size:12px;">En análisis...</span>'}</td>
                    <td>${this.buildGapsCell(c)}</td>
                    <td><span class="status-badge ${statusClass}">${c.status || 'REVISAR'}</span></td>
                    <td onclick="event.stopPropagation()">
                        <div class="action-btns">
                            <button class="action-btn action-btn--email"
                                    onclick="window.app.dashboard.sendEmail(${index}, event)"
                                    title="Enviar correo">
                                <i class="fa-solid fa-envelope"></i>
                            </button>
                            <button class="action-btn action-btn--msg"
                                    onclick="window.app.dashboard.sendMessage(${index}, event)"
                                    title="Enviar mensaje">
                                <i class="fa-solid fa-comment"></i>
                            </button>
                            <button class="action-btn action-btn--del"
                                    onclick="window.app.dashboard.deleteCandidate(${index}, event)"
                                    title="Eliminar CV">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openModal(index) {
        const c = this.candidates[index];
        if (!c || !this.modal) return;

        if (this.modalName) this.modalName.innerText = c.name;

        const skills = c.parsed_json?.skills_clave || c.parsed_json?.habilidades || [];
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

    sendEmail(index, event) {
        if (event) event.stopPropagation();
        const c = this.candidates[index];
        if (!c) return;
        const subject = encodeURIComponent(`Proceso de selección - ${c.name}`);
        const body = encodeURIComponent(`Hola ${c.name},\n\nTe contactamos respecto al proceso de selección.\n\nSaludos,\nEquipo de RRHH`);
        window.open(`mailto:${c.email || ''}?subject=${subject}&body=${body}`);
    }

    sendMessage(index, event) {
        if (event) event.stopPropagation();
        const c = this.candidates[index];
        if (!c) return;
        const text = encodeURIComponent(`Hola ${c.name}, te contactamos sobre tu candidatura.`);
        window.open(`https://wa.me/?text=${text}`);
    }

    // Used by Base de Talentos action buttons (referenced by email/name, not array index)
    sendEmailById(email, name) {
        const subject = encodeURIComponent(`Proceso de selección - ${name}`);
        const body = encodeURIComponent(`Hola ${name},\n\nTe contactamos respecto al proceso de selección.\n\nSaludos,\nEquipo de RRHH`);
        window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    }

    sendMessageById(name) {
        const text = encodeURIComponent(`Hola ${name}, te contactamos sobre tu candidatura.`);
        window.open(`https://wa.me/?text=${text}`);
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

    /**
     * Procesa la carga de archivos CV en lote de manera asíncrona:
     * 1. Genera batchId único (UUID)
     * 2. Sube los archivos a Supabase Storage (bucket 'cvs')
     * 3. Registra candidatos pendientes en Supabase (status: 'PENDING')
     * 4. Notifica a n8n con payload JSON { batch_id: batchId }
     */
    async processAsyncCvBatch(files, event) {
        if (!files || files.length === 0) return;

        const vacanteId = this.currentVacanteId || document.getElementById('vacanteSelect')?.value;
        if (!vacanteId) {
            alert('Por favor selecciona una vacante antes de subir CVs.');
            if (event?.target) event.target.value = '';
            return;
        }

        const btnTextSpan = document.getElementById('uploadBtnText') || document.getElementById('uploadMultipleBtnText');
        const originalHtml = btnTextSpan ? btnTextSpan.innerHTML : '';
        if (btnTextSpan) {
            btnTextSpan.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Subiendo ${files.length} CV(s)...`;
        }

        // Simulación visual en Centro de Agentes
        if (window.app.agents) {
            window.app.agents.runCvPipelineSimulation(`${files.length} CV(s)`);
        }

        try {
            // 1. Generar Lote único
            const batchId = crypto.randomUUID();
            telemetry.info(`Iniciando lote asíncrono ${batchId} para ${files.length} archivo(s)...`, 'DASHBOARD');

            // 2. Subir Archivos a Supabase Storage ('cvs')
            const pendingRecords = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const cleanFileName = supabaseService.normalizeFileName(file.name);
                const filePath = `${batchId}/${cleanFileName}`;

                if (btnTextSpan) {
                    btnTextSpan.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Subiendo (${i + 1}/${files.length}): ${cleanFileName}...`;
                }

                await supabaseService.uploadCvToStorage(filePath, file);

                // 3. Preparar registro pendiente
                pendingRecords.push({
                    vacante_id: vacanteId,
                    file_path: filePath,
                    status: 'PENDING',
                    batch_id: batchId
                });
            }

            // Registrar Candidatos Pendientes en base de datos
            if (btnTextSpan) {
                btnTextSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando expedientes...';
            }
            await supabaseService.createPendingCandidates(pendingRecords);

            // 4. Notificar a motor de IA
            if (btnTextSpan) {
                btnTextSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando motor de IA...';
            }
            const n8nResult = await n8nService.notifyBatchProcessing(batchId);

            if (n8nResult.success) {
                alert(`¡Archivos recibidos con éxito! Se cargaron ${files.length} CV(s) y el motor de Inteligencia Artificial ha iniciado la evaluación en segundo plano.`);
            } else {
                alert(`Los expedientes fueron guardados con éxito. Estado del servicio de IA: ${n8nResult.status}.`);
            }

            // Recargar candidatos de la vacante para reflejar los nuevos registros
            await this.loadCandidates(vacanteId);

        } catch (err) {
            console.error('Error en el flujo de carga asíncrona:', err);
            alert(`Error durante la carga de CVs: ${err.message}`);
        } finally {
            if (btnTextSpan) btnTextSpan.innerHTML = originalHtml;
            if (event?.target) event.target.value = '';
        }
    }

    async uploadCvFile(event) {
        const files = event.target.files;
        return this.processAsyncCvBatch(files, event);
    }

    async uploadMultipleCvs(event) {
        const files = event.target.files;
        return this.processAsyncCvBatch(files, event);
    }

}