/**
 * TalentOS - Analytics & Statistical Dashboard Controller
 * Genera métricas ejecutivas, embudo de selección, distribución de talento y análisis de mercado
 */

import { supabaseService } from '../services/supabase.js';
import { telemetry } from '../services/telemetry.js';
import { n8nService } from '../services/n8n.js';

export class AnalyticsController {
    constructor() {
        this.vacantes = [];
        this.candidates = [];
        this.isLoading = false;
    }

    async loadAnalytics() {
        this.isLoading = true;
        telemetry.info('Calculando analítica y estadísticas globales...', 'ANALYTICS');

        try {
            const [vacantesData, candidatesData] = await Promise.all([
                supabaseService.getVacantes(),
                supabaseService.getTalentos()
            ]);

            this.vacantes = vacantesData || [];
            this.candidates = candidatesData || [];

            this.render();
            telemetry.success('Dashboard estadístico actualizado correctamente', 'ANALYTICS');
        } catch (err) {
            telemetry.error(`Error al cargar analítica: ${err.message}`, 'ANALYTICS');
        } finally {
            this.isLoading = false;
        }
    }

    render() {
        const totalCandidates = this.candidates.length;
        const totalVacantes = this.vacantes.length;

        const evaluated = this.candidates.filter(c => (c.score_hybrid || 0) > 0);
        const totalEvaluated = evaluated.length;

        const countInterview = this.candidates.filter(c => c.status === 'ENTREVISTAR').length;
        const countReview = this.candidates.filter(c => c.status === 'REVISAR').length;
        const countDiscard = this.candidates.filter(c => c.status === 'DESCARTAR').length;
        const countPending = this.candidates.filter(c => c.status === 'PENDING' || !c.status).length;

        const avgScore = totalEvaluated > 0
            ? Math.round(evaluated.reduce((acc, c) => acc + (c.score_hybrid || 0), 0) / totalEvaluated)
            : 0;

        const shortlistRate = totalCandidates > 0
            ? Math.round((countInterview / totalCandidates) * 100)
            : 0;

        // 1. Render Global KPIs
        this.updateEl('dashTotalCand', totalCandidates);
        this.updateEl('dashTotalVacantes', totalVacantes);
        this.updateEl('dashShortlistCount', countInterview);
        this.updateEl('dashShortlistRate', `${shortlistRate}% del total`);
        this.updateEl('dashAvgScore', `${avgScore}/100`);
        this.updateEl('dashAvgSub', `Basado en ${totalEvaluated} evaluados`);

        // 2. Render Funnel / Pipeline Breakdown
        this.renderPipelineFunnel(totalCandidates, countInterview, countReview, countDiscard, countPending);

        // 3. Render Vacancies Analytics Grid
        this.renderVacantesAnalytics();

        // 4. Render Skills & Gaps Radar
        this.renderSkillsFrequency();
        this.renderGapsFrequency();

        // 5. Update Pending CVs Action Button
        this.updatePendingButton(countPending);
    }

    renderPipelineFunnel(total, interview, review, discard, pending) {
        const pct = (val) => total > 0 ? Math.round((val / total) * 100) : 0;

        const barInterview = document.getElementById('funnelBarInterview');
        const barReview = document.getElementById('funnelBarReview');
        const barDiscard = document.getElementById('funnelBarDiscard');
        const barPending = document.getElementById('funnelBarPending');

        if (barInterview) {
            barInterview.style.width = `${pct(interview)}%`;
            barInterview.title = `Entrevistar: ${interview} (${pct(interview)}%)`;
        }
        if (barReview) {
            barReview.style.width = `${pct(review)}%`;
            barReview.title = `Revisar: ${review} (${pct(review)}%)`;
        }
        if (barDiscard) {
            barDiscard.style.width = `${pct(discard)}%`;
            barDiscard.title = `Descartar: ${discard} (${pct(discard)}%)`;
        }
        if (barPending) {
            barPending.style.width = `${pct(pending)}%`;
            barPending.title = `Pendientes: ${pending} (${pct(pending)}%)`;
        }

        this.updateEl('countFunnelInterview', `${interview} (${pct(interview)}%)`);
        this.updateEl('countFunnelReview', `${review} (${pct(review)}%)`);
        this.updateEl('countFunnelDiscard', `${discard} (${pct(discard)}%)`);
        this.updateEl('countFunnelPending', `${pending} (${pct(pending)}%)`);
    }

    renderVacantesAnalytics() {
        const container = document.getElementById('dashVacantesGrid');
        if (!container) return;

        if (this.vacantes.length === 0) {
            container.innerHTML = '<p style="color:#94a3b8; font-size:13px;">No hay vacantes para analizar.</p>';
            return;
        }

        // Mapear candidatos por vacante
        const candByVacante = {};
        this.candidates.forEach(c => {
            const vId = c.vacante_id || 'SIN_ASIGNAR';
            if (!candByVacante[vId]) candByVacante[vId] = [];
            candByVacante[vId].push(c);
        });

        container.innerHTML = this.vacantes.map(v => {
            const cands = candByVacante[v.id] || [];
            const count = cands.length;
            const evalCands = cands.filter(c => (c.score_hybrid || 0) > 0);
            const avg = evalCands.length
                ? Math.round(evalCands.reduce((a, b) => a + (b.score_hybrid || 0), 0) / evalCands.length)
                : 0;
            const shortlistCount = cands.filter(c => c.status === 'ENTREVISTAR').length;
            const badgeType = v.is_demo ? '<span class="dash-badge-demo">Ejemplo</span>' : '<span class="dash-badge-private">Privada</span>';

            return `
                <div class="dash-vacante-stat-card">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span class="badge-req" style="font-size:11px;">${v.id}</span>
                                ${badgeType}
                            </div>
                            <h4 style="font-size:14px; font-weight:700; color:var(--text-primary); margin-top:6px;">${v.titulo}</h4>
                            <p style="font-size:11.5px; color:var(--text-muted);">${v.area || 'General'}</p>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:20px; font-weight:700; color:${avg >= 80 ? '#059669' : avg >= 60 ? '#d97706' : '#2563eb'};">
                                ${avg}
                            </span>
                            <span style="font-size:10px; color:#64748b; display:block;">Match Promedio</span>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:14px; padding-top:12px; border-top:1px solid #f1f5f9;">
                        <div>
                            <span style="font-size:11px; color:#64748b;">Postulantes:</span>
                            <strong style="display:block; font-size:15px; color:#1e293b;">${count}</strong>
                        </div>
                        <div>
                            <span style="font-size:11px; color:#64748b;">Shortlist:</span>
                            <strong style="display:block; font-size:15px; color:#059669;">${shortlistCount} listos</strong>
                        </div>
                    </div>

                    <div style="margin-top:12px; display:flex; gap:8px;">
                        <button class="btn btn-white" style="flex:1; justify-content:center; padding:7px 12px; font-size:12px;" onclick="window.app.irAVacante('${v.id}')">
                            <i class="fa-solid fa-users-viewfinder"></i> Ver Screening
                        </button>
                        <button class="btn" style="background:#fff1f2; color:#be123c; border:1px solid #fecdd3; padding:7px 10px; font-size:12px;" onclick="window.app.vacantes.deleteVacante('${v.id}', '${(v.titulo || '').replace(/'/g, "\\'")}')" title="Eliminar vacante">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderSkillsFrequency() {
        const container = document.getElementById('dashTopSkills');
        if (!container) return;

        const freq = {};
        this.candidates.forEach(c => {
            const skills = c.parsed_json?.habilidades || c.parsed_json?.skills_clave || [];
            if (Array.isArray(skills)) {
                skills.forEach(s => {
                    const clean = s.trim();
                    if (clean.length > 1) {
                        freq[clean] = (freq[clean] || 0) + 1;
                    }
                });
            }
        });

        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (sorted.length === 0) {
            container.innerHTML = '<p style="color:#94a3b8; font-size:12px;">Sin datos de habilidades procesadas aún.</p>';
            return;
        }

        const max = sorted[0][1] || 1;

        container.innerHTML = sorted.map(([skill, count]) => {
            const pct = Math.round((count / max) * 100);
            return `
                <div style="margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                        <strong style="color:#334155;">${skill}</strong>
                        <span style="color:#64748b; font-size:11px;">${count} candidatos</span>
                    </div>
                    <div style="background:#e2e8f0; border-radius:9999px; height:6px; overflow:hidden;">
                        <div style="background:#2563eb; width:${pct}%; height:100%; border-radius:9999px; transition:width 0.4s ease;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderGapsFrequency() {
        const container = document.getElementById('dashTopGaps');
        if (!container) return;

        const freq = {};
        this.candidates.forEach(c => {
            const gaps = c.parsed_json?.gaps || c.gaps || [];
            if (Array.isArray(gaps)) {
                gaps.forEach(g => {
                    const clean = g.trim();
                    if (clean.length > 3) {
                        freq[clean] = (freq[clean] || 0) + 1;
                    }
                });
            }
        });

        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6);
        if (sorted.length === 0) {
            container.innerHTML = '<p style="color:#059669; font-size:12px;"><i class="fa-solid fa-circle-check"></i> Pocos gaps críticos detectados en el pool de talentos.</p>';
            return;
        }

        container.innerHTML = sorted.map(([gap, count]) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; padding:7px 12px; margin-bottom:6px; font-size:12px;">
                <span style="color:#be123c; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px;" title="${gap}">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;"></i> ${gap}
                </span>
                <span style="background:#fff; color:#be123c; font-weight:700; font-size:10px; padding:2px 6px; border-radius:4px; border:1px solid #fecdd3;">
                    ${count}
                </span>
            </div>
        `).join('');
    }

    updateEl(id, val) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }

    updatePendingButton(pendingCount) {
        const btn = document.getElementById('btnProcessPending');
        const countSpan = document.getElementById('btnPendingCount');
        if (countSpan) countSpan.textContent = pendingCount;
        if (btn) {
            btn.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
        }
    }

    async triggerPendingScreening() {
        const btn = document.getElementById('btnProcessPending');
        const pendingCount = this.candidates.filter(c => c.status === 'PENDING').length;

        if (pendingCount === 0) {
            alert('¡Excelente! Todos los candidatos registrados han sido evaluados.');
            return;
        }

        const confirmMsg = `¿Deseas iniciar la evaluación inteligente de los ${pendingCount} CVs pendientes con el motor de Inteligencia Artificial?`;
        if (!confirm(confirmMsg)) return;

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Evaluando con IA...';
            }

            const res = await n8nService.notifyBatchProcessing(`batch_resume_${Date.now()}`);
            if (res.success) {
                alert(`🚀 ¡Evaluación con IA iniciada con éxito para los ${pendingCount} CVs pendientes!\n\nEl sistema está analizando los expedientes en segundo plano.\nPuedes pulsar en "Actualizar Métricas" periódicamente para observar el avance en tiempo real.`);
            } else {
                alert(`Aviso del sistema: El servicio de procesamiento respondió con código ${res.status}.`);
            }
        } catch (err) {
            alert(`Error al iniciar la evaluación con IA: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                this.updatePendingButton(pendingCount);
            }
        }
    }
}
