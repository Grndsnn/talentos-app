/**
 * TalentOS - Vacantes Controller (Gestión Dinámica, Extractor de Requisitos con IA y Formulario en Pestaña)
 */

import { supabaseService } from '../services/supabase.js';
import { telemetry } from '../services/telemetry.js';

// Catálogo de habilidades multi-nicho para reconocimiento inteligente
const SKILLS_CATALOG = [
    // Tecnología & Datos
    'Python', 'SQL', 'PostgreSQL', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Vue.js',
    'AWS', 'Docker', 'Kubernetes', 'Power BI', 'BigQuery', 'Git', 'FastAPI', 'Django',
    'Linux', 'Seguridad de Datos', 'ETL', 'REST APIs', 'Figma', 'UI/UX',
    
    // Finanzas & Contabilidad
    'Excel Avanzado', 'Modelos Financieros', 'Análisis de Riesgo', 'Flujo de Caja', 'Nómina',
    'Conciliaciones', 'Impuestos / Tributaria', 'NIIF', 'Estados Financieros', 'Auditoría',
    'SAP', 'Siigo', 'Presupuestos', 'Gestión de Cartera', 'Facturación Electrónica',

    // Logística, Operaciones & Cadena de Suministro
    'WMS', 'Control de Inventarios', 'Gestión de Stock', 'Cadena de Suministro', 'Despacho',
    'Operación de Montacargas', 'Planificación de Rutas', 'Compras', 'Auditoría de Almacén',
    'Lean Manufacturing', 'Picking & Packing', 'Manejo de Proveedores', 'Logística Inversa',

    // Recursos Humanos & Talento
    'Selección de Personal', 'Reclutamiento B2B / IT', 'Pruebas Psicotécnicas', 'Clima Organizacional',
    'Bienestar Laboral', 'Legislación Laboral', 'Evaluación de Desempeño', 'Contratación',
    'Capacitación y Desarrollo', 'Gestión del Talento', 'Headhunting',

    // Mercadeo, Comercial & Ventas
    'Ventas B2B', 'Prospección Comercial', 'Cierre de Ventas', 'CRM', 'HubSpot', 'Salesforce',
    'SEO', 'SEM', 'Google Ads', 'Meta Ads', 'Marketing de Contenidos', 'Analítica Web',
    'Copywriting', 'Estrategia de Redes', 'KPIs Comerciales', 'Atención al Cliente',

    // Construcción, Arquitectura & Ingeniería
    'AutoCAD', 'Revit', 'Presupuestos de Obra', 'Supervisión de Obra', 'Normas SST',
    'Seguridad Industrial', 'Control de Cronogramas', 'Lectura de Planos', 'Topografía',
    'Interventoría', 'Control de Calidad en Obra',

    // Salud & Farmacia
    'Atención al Paciente', 'Triaje', 'Protocolos de Bioseguridad', 'Historia Clínica',
    'Administración de Medicamentos', 'Cuidados Críticos', 'Farmacología',

    // Habilidades Transversales
    'Liderazgo de Equipos', 'Negociación', 'Resolución de Problemas', 'Trabajo bajo Presión',
    'Comunicación Asertiva', 'Orientación a Resultados', 'Gestión del Tiempo'
];

export class VacantesController {
    constructor(onVacanteSelectCallback) {
        this.vacantes = [];
        this.currentVacanteId = null;
        this.onVacanteSelectCallback = onVacanteSelectCallback;
        this.extractedSkills = new Set();

        this.selectEl = document.getElementById('vacanteSelect');
        this.gridEl = document.getElementById('vacantesGrid');

        this.initEvents();
        this.initFormEvents();
    }

    initEvents() {
        if (this.selectEl) {
            this.selectEl.addEventListener('change', (e) => {
                this.currentVacanteId = e.target.value;
                if (typeof this.onVacanteSelectCallback === 'function') {
                    this.onVacanteSelectCallback(this.currentVacanteId);
                }
            });
        }
    }

    initFormEvents() {
        const descInput = document.getElementById('nvDescripcion');
        const tituloInput = document.getElementById('nvTitulo');
        const form = document.getElementById('formNuevaVacante');
        const btnAddSkill = document.getElementById('btnAddCustomSkill');
        const inputCustomSkill = document.getElementById('inputCustomSkill');

        // Extracción automática en tiempo real con debounce
        let debounceTimer = null;
        const triggerExtraction = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const text = `${tituloInput?.value || ''} ${descInput?.value || ''}`;
                this.analyzeAndExtractSkills(text);
            }, 300);
        };

        if (descInput) descInput.addEventListener('input', triggerExtraction);
        if (tituloInput) tituloInput.addEventListener('input', triggerExtraction);

        // Agregar habilidad personalizada manualmente
        if (btnAddSkill && inputCustomSkill) {
            const addManualSkill = () => {
                const val = inputCustomSkill.value.trim();
                if (val) {
                    this.extractedSkills.add(val);
                    inputCustomSkill.value = '';
                    this.renderSkillsChips();
                }
            };

            btnAddSkill.addEventListener('click', (e) => {
                e.preventDefault();
                addManualSkill();
            });

            inputCustomSkill.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addManualSkill();
                }
            });
        }

        // Envío del formulario
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCreateVacanteSubmit();
            });
        }
    }

    /**
     * Motor de Extracción Automática Inteligente
     * Detecta nicho, años de experiencia y habilidades desde la descripción
     */
    analyzeAndExtractSkills(text) {
        if (!text || text.trim().length < 5) return;

        const normalizedText = text.toLowerCase();

        // 1. Detección automática de habilidades del catálogo
        SKILLS_CATALOG.forEach(skill => {
            const pattern = new RegExp(`\\b${skill.toLowerCase().replace(/[\/\+\-]/g, '\\$&')}\\b`, 'i');
            if (pattern.test(normalizedText)) {
                this.extractedSkills.add(skill);
            }
        });

        // 2. Detección de patrones explícitos: "manejo de X", "conocimiento en Y", "experiencia con Z"
        const patterns = [
            /(?:manejo de|conocimientos en|experiencia con|dominio de|requisito(?:s)?:?)\s+([a-záéíóúñ0-9\s,\/\.\-]+?)(?:\.|\n|;|$)/gi
        ];

        patterns.forEach(regex => {
            let match;
            while ((match = regex.exec(text)) !== null) {
                const items = match[1].split(/,| y | e /i);
                items.forEach(item => {
                    const clean = item.trim();
                    if (clean.length > 2 && clean.length < 35 && !['etc', 'otros', 'general'].includes(clean.toLowerCase())) {
                        const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
                        this.extractedSkills.add(capitalized);
                    }
                });
            }
        });

        // 3. Estimación automática de años de experiencia
        const expMatch = text.match(/(?:m[ií]nimo|al menos|experiencia de|con|m[aá]s de|\+)\s*(\d+)\s*(?:a[ñn]o|a[ñn]os)/i);
        const aniosInput = document.getElementById('nvAnios');
        if (expMatch && expMatch[1] && aniosInput && (!aniosInput.value || aniosInput.value === '0')) {
            aniosInput.value = expMatch[1];
        }

        // 4. Inferencia sugerida de Área / Nicho
        const areaInput = document.getElementById('nvArea');
        if (areaInput && (!areaInput.value || areaInput.value === 'General')) {
            if (/log[ií]stic|almac[eé]n|inventario|despacho|stock/i.test(normalizedText)) {
                areaInput.value = 'Logística y Almacén';
            } else if (/ventas|comercial|prospecci[oó]n|marketing|mercadeo|seo/i.test(normalizedText)) {
                areaInput.value = 'Comercial & Marketing';
            } else if (/contab|financ|tributar|n[oó]mina|impuesto|tesorer/i.test(normalizedText)) {
                areaInput.value = 'Finanzas & Contabilidad';
            } else if (/obra|construc|autocad|civil|arquitect/i.test(normalizedText)) {
                areaInput.value = 'Construcción e Ingeniería';
            } else if (/recursos humanos|rrhh|selecci[oó]n|talento/i.test(normalizedText)) {
                areaInput.value = 'Recursos Humanos';
            } else if (/salud|m[eé]dic|enferm|cl[ií]nic|paciente/i.test(normalizedText)) {
                areaInput.value = 'Salud & Medicina';
            } else if (/software|desarroll|programad|python|developer|tecnolog/i.test(normalizedText)) {
                areaInput.value = 'Tecnología';
            }
        }

        this.renderSkillsChips();
    }

    renderSkillsChips() {
        const container = document.getElementById('extractedSkillsContainer');
        const countBadge = document.getElementById('extractedSkillsCount');
        if (!container) return;

        if (this.extractedSkills.size === 0) {
            container.innerHTML = `
                <div style="color:#94a3b8; font-size:12px; font-style:italic; padding:8px 0;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Escribe la descripción del cargo para extraer habilidades clave automáticamente...
                </div>
            `;
            if (countBadge) countBadge.textContent = '0 detectadas';
            return;
        }

        if (countBadge) countBadge.textContent = `${this.extractedSkills.size} detectadas`;

        container.innerHTML = Array.from(this.extractedSkills).map(skill => `
            <span class="skill-chip-interactive" title="Clic para eliminar">
                <span>${skill}</span>
                <button type="button" onclick="window.app.vacantes.removeSkill('${skill.replace(/'/g, "\\'")}')">&times;</button>
            </span>
        `).join('');
    }

    removeSkill(skillName) {
        this.extractedSkills.delete(skillName);
        this.renderSkillsChips();
    }

    async handleCreateVacanteSubmit() {
        const tituloEl = document.getElementById('nvTitulo');
        const areaEl = document.getElementById('nvArea');
        const aniosEl = document.getElementById('nvAnios');
        const descEl = document.getElementById('nvDescripcion');
        const submitBtn = document.getElementById('btnSubmitVacante');

        const titulo = tituloEl?.value.trim();
        const area = areaEl?.value.trim() || 'General';
        const anios_min = parseInt(aniosEl?.value, 10) || 0;
        const descripcion = descEl?.value.trim();

        if (!titulo) {
            alert('Por favor indica el título o cargo de la vacante.');
            tituloEl?.focus();
            return;
        }

        if (!descripcion) {
            alert('Por favor proporciona una breve descripción del cargo para que la IA pueda calificar los candidatos con precisión.');
            descEl?.focus();
            return;
        }

        const skills = Array.from(this.extractedSkills);

        const payload = {
            titulo,
            area,
            anios_min,
            descripcion,
            skills_requeridas: skills
        };

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando vacante...';
        }

        try {
            const created = await supabaseService.createVacante(payload);
            telemetry.success(`Nueva vacante "${created.titulo}" activada`, 'VACANTES');

            alert(`¡Vacante "${created.titulo}" (${created.id}) creada y activada exitosamente!\nAhora puedes subir CVs para este perfil.`);

            // Limpiar formulario
            tituloEl.value = '';
            areaEl.value = '';
            aniosEl.value = '1';
            descEl.value = '';
            this.extractedSkills.clear();
            this.renderSkillsChips();

            // Recargar lista y seleccionar la nueva vacante
            await this.loadVacantes();
            this.setVacante(created.id);

            // Cambiar a la vista del Dashboard para ver o subir CVs de inmediato
            if (window.app && typeof window.app.irAVacante === 'function') {
                window.app.irAVacante(created.id);
            }
        } catch (err) {
            telemetry.error(`Fallo al crear vacante: ${err.message}`, 'VACANTES');
            alert(`Error al crear la vacante: ${err.message}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publicar y Activar Vacante';
            }
        }
    }

    async loadVacantes() {
        if (this.selectEl) {
            this.selectEl.innerHTML = '<option value="">Cargando catálogo de vacantes...</option>';
        }

        try {
            this.vacantes = await supabaseService.getVacantes();

            if (!this.vacantes || this.vacantes.length === 0) {
                if (this.selectEl) this.selectEl.innerHTML = '<option value="">Sin vacantes activas. ¡Crea una!</option>';
                if (this.gridEl) this.gridEl.innerHTML = '<p style="color:#94a3b8;">No tienes vacantes registradas aún. Haz clic en "Nueva Vacante".</p>';
                return [];
            }

            if (this.selectEl) {
                this.selectEl.innerHTML = this.vacantes.map(v => {
                    const tagDemo = v.is_demo ? ' [Ejemplo]' : '';
                    return `<option value="${v.id}">${v.id} · ${v.titulo}${tagDemo}</option>`;
                }).join('');

                // Mantener selección si existe o tomar la primera
                if (!this.currentVacanteId || !this.vacantes.some(v => v.id === this.currentVacanteId)) {
                    this.currentVacanteId = this.vacantes[0].id;
                }
                this.selectEl.value = this.currentVacanteId;
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
            this.gridEl.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:50px 20px; background:#fff; border-radius:12px; border:1px dashed #cbd5e1;">
                    <i class="fa-solid fa-briefcase" style="font-size:36px; color:#94a3b8; margin-bottom:12px;"></i>
                    <h3 style="font-size:16px; color:#1e293b; font-weight:700;">No hay vacantes activas</h3>
                    <p style="font-size:13px; color:#64748b; margin-top:6px; margin-bottom:18px;">Crea una nueva vacante para tu empresa o nicho para comenzar a recibir y evaluar CVs.</p>
                    <button class="btn btn-primary" onclick="window.app.switchView('nuevaVacante')">
                        <i class="fa-solid fa-plus"></i> Crear Nueva Vacante
                    </button>
                </div>
            `;
            return;
        }

        this.gridEl.innerHTML = this.vacantes.map(v => {
            const skills = (v.skills_requeridas || []).slice(0, 8).map(s => 
                `<span class="skill-tag">${s}</span>`
            ).join('');

            const badgeDemo = v.is_demo ? `
                <span style="font-size:10px; background:#f1f5f9; color:#64748b; padding:2px 6px; border-radius:4px; font-weight:600; margin-left:6px; border:1px solid #e2e8f0;">
                    <i class="fa-solid fa-layer-group"></i> Ejemplo
                </span>
            ` : `
                <span style="font-size:10px; background:#ecfdf5; color:#059669; padding:2px 6px; border-radius:4px; font-weight:600; margin-left:6px; border:1px solid #a7f3d0;">
                    <i class="fa-solid fa-shield-halved"></i> Empresarial Privada
                </span>
            `;

            return `
                <div class="vacante-card">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <div style="display:flex; align-items:center;">
                                <span class="badge-req">${v.id}</span>
                                ${badgeDemo}
                            </div>
                            <h3 style="font-size:16px; font-weight:700; color:var(--text-primary); margin-top:8px;">${v.titulo}</h3>
                            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                                <i class="fa-solid fa-industry" style="margin-right:4px;"></i>${v.area || 'Área General'}
                            </p>
                        </div>
                        <span style="font-size:12px; background:#eff6ff; color:#1d4ed8; padding:3px 8px; border-radius:6px; font-weight:600;">
                            ${v.anios_min ?? 0}+ años exp
                        </span>
                    </div>
                    
                    <p style="font-size:13px; color:var(--text-secondary); line-height:1.45; flex:1; margin: 12px 0;">
                        ${v.descripcion || 'Sin descripción detallada.'}
                    </p>
                    
                    <div style="margin-bottom:14px;">
                        <span style="font-size:11px; font-weight:600; color:var(--text-muted); display:block; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
                            Habilidades Requeridas por la Vacante
                        </span>
                        <div style="display:flex; flex-wrap:wrap; gap:5px;">
                            ${skills || '<span style="color:#94a3b8; font-size:12px;">Criterio general de evaluación</span>'}
                        </div>
                    </div>

                    <div style="border-top:1px solid var(--border-color); padding-top:12px; margin-top:auto; display:flex; gap:8px;">
                        <button class="btn btn-primary" style="flex:1; justify-content:center;" onclick="window.app.irAVacante('${v.id}')">
                            <i class="fa-solid fa-users"></i> Ver candidatos asociados
                        </button>
                        <button class="btn" style="background:#fff1f2; color:#be123c; border:1px solid #fecdd3; padding:8px 12px;" onclick="event.stopPropagation(); window.app.vacantes.deleteVacante('${v.id}', '${v.titulo.replace(/'/g, "\\'")}')" title="Eliminar vacante">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async deleteVacante(vacanteId, titulo) {
        if (!vacanteId) return;

        const confirmMsg = `¿Estás seguro de que deseas eliminar permanentemente la vacante "${titulo || vacanteId}"?\n\nEsta acción también eliminará todos los candidatos asociados a esta vacante.`;
        if (!confirm(confirmMsg)) return;

        try {
            telemetry.info(`Eliminando vacante ${vacanteId}...`, 'VACANTES');
            await supabaseService.deleteVacante(vacanteId);
            alert(`La vacante "${titulo || vacanteId}" ha sido eliminada exitosamente.`);

            // Recargar catálogo de vacantes
            const remaining = await this.loadVacantes();
            if (this.currentVacanteId === vacanteId) {
                if (remaining.length > 0) {
                    this.setVacante(remaining[0].id);
                } else {
                    this.currentVacanteId = null;
                }
            }

            // Actualizar vistas relacionadas
            if (window.app?.analytics) {
                window.app.analytics.loadAnalytics();
            }
            if (window.app?.dashboard && this.currentVacanteId) {
                window.app.dashboard.loadCandidates(this.currentVacanteId);
            }
        } catch (err) {
            telemetry.error(`Error al eliminar vacante: ${err.message}`, 'VACANTES');
            alert(`Error al eliminar vacante: ${err.message}`);
        }
    }

    async deleteCurrentVacante() {
        if (!this.currentVacanteId) {
            alert('No hay ninguna vacante seleccionada.');
            return;
        }
        const current = this.vacantes.find(v => v.id === this.currentVacanteId);
        await this.deleteVacante(this.currentVacanteId, current?.titulo || this.currentVacanteId);
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
