/**
 * TalentOS - Vacantes Controller
 */

import { supabaseService } from '../services/supabase.js';
import { telemetry } from '../services/telemetry.js';

export class VacantesController {
    constructor(onVacanteSelectCallback) {
        this.vacantes = [];
        this.currentVacanteId = null;
        this.onVacanteSelectCallback = onVacanteSelectCallback;
        this.selectEl = document.getElementById('vacanteSelect');
        this.gridEl = document.getElementById('vacantesGrid');

        if (this.selectEl) {
            this.selectEl.addEventListener('change', (e) => {
                this.currentVacanteId = e.target.value;
                if (typeof this.onVacanteSelectCallback === 'function') {
                    this.onVacanteSelectCallback(this.currentVacanteId);
                }
            });
        }
    }

    async loadVacantes() {
        if (this.selectEl) {
            this.selectEl.innerHTML = '<option value="">Cargando vacantes...</option>';
        }

        try {
            this.vacantes = await supabaseService.getVacantes();

            if (!this.vacantes || this.vacantes.length === 0) {
                if (this.selectEl) this.selectEl.innerHTML = '<option value="">Sin vacantes disponibles</option>';
                if (this.gridEl) this.gridEl.innerHTML = '<p style="color:#94a3b8;">No hay vacantes registradas.</p>';
                return [];
            }

            if (this.selectEl) {
                this.selectEl.innerHTML = this.vacantes.map(v => 
                    `<option value="${v.id}">${v.id} · ${v.titulo}</option>`
                ).join('');
                this.currentVacanteId = this.selectEl.value;
            }

            this.renderVacantesGrid();
            return this.vacantes;
        } catch (err) {
            if (this.selectEl) this.selectEl.innerHTML = '<option value="">Error al cargar vacantes</option>';
            telemetry.error(`Error en VacantesController: ${err.message}`, 'VACANTES');
            return [];
        }
    }

    renderVacantesGrid() {
        if (!this.gridEl) return;

        if (!this.vacantes.length) {
            this.gridEl.innerHTML = '<p style="color:#94a3b8;">No hay vacantes disponibles en la base de datos.</p>';
            return;
        }

        this.gridEl.innerHTML = this.vacantes.map(v => {
            const skills = (v.skills_requeridas || []).slice(0, 6).map(s => 
                `<span class="skill-tag">${s}</span>`
            ).join('');

            return `
                <div class="vacante-card">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span class="badge-req">${v.id}</span>
                            <h3 style="font-size:16px; font-weight:700; color:var(--text-primary); margin-top:8px;">${v.titulo}</h3>
                            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">${v.area || 'Área General'}</p>
                        </div>
                        <span style="font-size:12px; background:#eff6ff; color:#1d4ed8; padding:3px 8px; border-radius:6px; font-weight:600;">
                            ${v.anios_min ?? 0}+ años exp
                        </span>
                    </div>
                    
                    <p style="font-size:13px; color:var(--text-secondary); line-height:1.45; flex:1;">${v.descripcion || 'Sin descripción detallada.'}</p>
                    
                    <div>
                        <span style="font-size:11px; font-weight:600; color:var(--text-muted); display:block; margin-bottom:4px;">HABILIDADES REQUERIDAS</span>
                        <div>${skills || '<span style="color:#94a3b8; font-size:12px;">Generales</span>'}</div>
                    </div>

                    <div style="border-top:1px solid var(--border-color); padding-top:12px; margin-top:4px;">
                        <button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="window.app.irAVacante('${v.id}')">
                            <i class="fa-solid fa-users"></i> Ver candidatos asociados
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    getCurrentVacanteId() {
        return this.currentVacanteId;
    }

    setVacante(vacanteId) {
        this.currentVacanteId = vacanteId;
        if (this.selectEl) this.selectEl.value = vacanteId;
        if (typeof this.onVacanteSelectCallback === 'function') {
            this.onVacanteSelectCallback(vacanteId);
        }
    }
}
