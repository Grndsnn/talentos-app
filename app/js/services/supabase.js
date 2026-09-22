/**
 * TalentOS - Supabase Client & Data Service
 */

import { CONFIG } from '../config.js';
import { telemetry } from './telemetry.js';

class SupabaseService {
    constructor() {
        this.client = null;
        this.initClient();
    }

    async initClient() {
        try {
            const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
            const key = CONFIG.SUPABASE.ANON_KEY;
            this.client = createClient(CONFIG.SUPABASE.URL, key);
            console.log('Supabase client initialized, client object:', this.client);
            telemetry.success('Supabase client initialized with anon key', 'SUPABASE');
        } catch (err) {
            telemetry.error(`Failed to initialize Supabase client: ${err.message}`, 'SUPABASE');
        }

    }

    async getClient() {
        if (!this.client) {
            // Ensure the client is initialized before returning
            await this.initClient();
        }
        return this.client;
    }

    async checkConnection() {
        const startTime = performance.now();
        const client = await this.getClient();
        if (!client) {
            return { ok: false, latencyMs: 0, error: 'Cliente Supabase no disponible' };
        }

        try {
            const { data, error } = await client.from('vacantes').select('id').limit(1);
            const latencyMs = Math.round(performance.now() - startTime);

            if (error) {
                telemetry.error(`Check Supabase falló: ${error.message}`, 'SUPABASE');
                return { ok: false, latencyMs, error: error.message };
            }

            telemetry.info(`Conexión con Supabase verificada (${latencyMs}ms)`, 'SUPABASE');
            return { ok: true, latencyMs, data };
        } catch (err) {
            const latencyMs = Math.round(performance.now() - startTime);
            telemetry.error(`Excepción en Check Supabase: ${err.message}`, 'SUPABASE');
            return { ok: false, latencyMs, error: err.message };
        }
    }

    /* -------------------------------------------------------------------------- */
    /* Autenticación Real con Supabase Auth                                       */
    /* -------------------------------------------------------------------------- */

    async getCurrentUser() {
        const client = await this.getClient();
        if (!client) return null;
        try {
            const { data: { user }, error } = await client.auth.getUser();
            if (error || !user) return null;
            return user;
        } catch {
            return null;
        }
    }

    async getSession() {
        const client = await this.getClient();
        if (!client) return null;
        try {
            const { data: { session }, error } = await client.auth.getSession();
            if (error || !session) return null;
            return session;
        } catch {
            return null;
        }
    }

    async signIn(email, password) {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        telemetry.info(`Autenticando usuario: ${email}...`, 'AUTH');
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
            telemetry.error(`Error de autenticación: ${error.message}`, 'AUTH');
            throw error;
        }

        telemetry.success(`Sesión iniciada con éxito: ${data.user?.email}`, 'AUTH');
        return data;
    }

    async signUp(email, password) {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        telemetry.info(`Creando cuenta para: ${email}...`, 'AUTH');
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) {
            telemetry.error(`Error al registrar usuario: ${error.message}`, 'AUTH');
            throw error;
        }

        telemetry.success(`Cuenta creada correctamente: ${data.user?.email || email}`, 'AUTH');
        return data;
    }

    async signOut() {
        const client = await this.getClient();
        if (!client) return;

        telemetry.info('Cerrando sesión en Supabase...', 'AUTH');
        const { error } = await client.auth.signOut();
        if (error) {
            telemetry.error(`Error al cerrar sesión: ${error.message}`, 'AUTH');
            throw error;
        }
        telemetry.success('Sesión cerrada exitosamente', 'AUTH');
    }

    async onAuthStateChange(callback) {
        const client = await this.getClient();
        if (!client || typeof callback !== 'function') return null;
        return client.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }

    /* -------------------------------------------------------------------------- */
    /* Vacantes y Multi-Inquilino                                                 */
    /* -------------------------------------------------------------------------- */

    async createVacante(vacanteData) {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        const currentUser = await this.getCurrentUser();
        const cleanArea = (vacanteData.area || 'GEN').trim();
        const prefix = cleanArea.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'VAC');
        const generatedId = vacanteData.id || `${prefix}-${Date.now().toString(36).toUpperCase()}`;

        const newVacante = {
            id: generatedId,
            titulo: vacanteData.titulo.trim(),
            area: cleanArea,
            descripcion: vacanteData.descripcion || '',
            skills_requeridas: vacanteData.skills_requeridas || [],
            anios_min: Number(vacanteData.anios_min) || 0,
            user_id: currentUser ? currentUser.id : null,
            is_demo: false
        };

        telemetry.info(`Creando nueva vacante "${newVacante.titulo}" (${newVacante.id})...`, 'SUPABASE');
        const { data, error } = await client
            .from('vacantes')
            .insert([newVacante])
            .select()
            .single();

        if (error) {
            telemetry.error(`Error al crear vacante en Supabase: ${error.message}`, 'SUPABASE');
            throw error;
        }

        telemetry.success(`Vacante ${newVacante.titulo} creada con éxito`, 'SUPABASE');
        return data;
    }

    async getVacantes() {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        telemetry.info('Consultando vacantes activas...', 'SUPABASE');
        const { data, error } = await client
            .from('vacantes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            telemetry.error(`Error al cargar vacantes: ${error.message}`, 'SUPABASE');
            throw error;
        }

        telemetry.success(`${data ? data.length : 0} vacantes obtenidas con éxito`, 'SUPABASE');
        return data || [];
    }

    async deleteVacante(vacanteId) {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        telemetry.info(`Eliminando vacante ${vacanteId} y sus candidatos asociados...`, 'SUPABASE');

        // Eliminar primero candidatos asociados a esta vacante para garantizar integridad
        const { error: candError } = await client
            .from('candidates')
            .delete()
            .eq('vacante_id', vacanteId);

        if (candError) {
            telemetry.warn(`Aviso al eliminar candidatos de la vacante: ${candError.message}`, 'SUPABASE');
        }

        const { data, error } = await client
            .from('vacantes')
            .delete()
            .eq('id', vacanteId);

        if (error) {
            telemetry.error(`Error al eliminar vacante en Supabase: ${error.message}`, 'SUPABASE');
            throw error;
        }

        telemetry.success(`Vacante ${vacanteId} eliminada correctamente`, 'SUPABASE');
        return data;
    }

    async getCandidatesByVacante(vacanteId) {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        telemetry.info(`Consultando candidatos para vacante: ${vacanteId || 'TODAS'}`, 'SUPABASE');
        let query = client.from('candidates').select('*, vacantes(titulo, area)');

        if (vacanteId) {
            query = query.eq('vacante_id', vacanteId);
        }

        const { data, error } = await query.order('score_hybrid', { ascending: false });

        if (error) {
            telemetry.error(`Error al obtener candidatos: ${error.message}`, 'SUPABASE');
            throw error;
        }

        telemetry.success(`${data ? data.length : 0} candidatos cargados`, 'SUPABASE');
        return data || [];
    }

    async getTalentos() {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        telemetry.info('Consultando base global de talentos...', 'SUPABASE');
        const { data, error } = await client
            .from('candidates')
            .select('*, vacantes(titulo)')
            .order('score_hybrid', { ascending: false });

        if (error) {
            telemetry.error(`Error al obtener base de talentos: ${error.message}`, 'SUPABASE');
            throw error;
        }

        telemetry.success(`${data ? data.length : 0} talentos globales recuperados`, 'SUPABASE');
        return data || [];
    }

    async upsertCandidate(candidate) {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        const currentUser = await this.getCurrentUser();
        const candidatePayload = {
            ...candidate,
            ...(currentUser ? { user_id: currentUser.id } : {})
        };

        telemetry.info(`Upserting candidato: ${candidate.name} (${candidate.email})`, 'SUPABASE');
        const { data, error } = await client
            .from('candidates')
            .upsert([candidatePayload], { onConflict: 'email,vacante_id' });

        if (error) {
            telemetry.error(`Error upserting candidato: ${error.message}`, 'SUPABASE');
            throw error;
        }

        telemetry.success(`Candidato ${candidate.name} guardado correctamente`, 'SUPABASE');
        return data;
    }

    async deleteCandidate(id, email, vacanteId) {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        telemetry.info(`Eliminando candidato ${id || email}...`, 'SUPABASE');
        let query = client.from('candidates').delete();
        if (id) {
            query = query.eq('id', id);
        } else if (email) {
            query = query.eq('email', email);
            if (vacanteId) query = query.eq('vacante_id', vacanteId);
        } else {
            throw new Error('Identificador de candidato no proporcionado');
        }

        const { data, error } = await query;
        if (error) {
            telemetry.error(`Error al eliminar candidato: ${error.message}`, 'SUPABASE');
            throw error;
        }

        telemetry.success(`Candidato eliminado exitosamente`, 'SUPABASE');
        return data;
    }

    /**
     * Normaliza un nombre de archivo para eliminar tildes, diacríticos, espacios y caracteres especiales.
     * Convierte por ejemplo "Currículum de José María (2026).pdf" a "Curriculum_de_Jose_Maria_2026.pdf".
     * @param {string} fileName - Nombre original del archivo
     * @returns {string} Nombre limpio y normalizado
     */
    normalizeFileName(fileName) {
        if (!fileName) return 'cv.pdf';
        fileName = fileName.trim();
        const lastDotIndex = fileName.lastIndexOf('.');
        const ext = lastDotIndex !== -1 ? fileName.slice(lastDotIndex).trim().toLowerCase() : '';
        const nameWithoutExt = lastDotIndex !== -1 ? fileName.slice(0, lastDotIndex) : fileName;

        const cleanName = nameWithoutExt
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ñ/g, 'n')
            .replace(/Ñ/g, 'N')
            .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');

        return `${cleanName || 'cv'}${ext}`;
    }

    /**
     * Sube un archivo PDF al bucket 'cvs' de Supabase Storage.
     * @param {string} filePath - Ruta en el bucket (ej. `${batchId}/${file.name}`)
     * @param {File} file - Archivo PDF a subir
     */
    async uploadCvToStorage(filePath, file) {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        telemetry.info(`Subiendo ${file.name} a Supabase Storage (cvs/${filePath})...`, 'SUPABASE');
        const { data, error } = await client.storage
            .from('cvs')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) {
            telemetry.error(`Error al subir ${file.name} a Storage: ${error.message}`, 'SUPABASE');
            throw error;
        }

        telemetry.success(`Archivo ${file.name} subido a Storage correctamente`, 'SUPABASE');
        return data;
    }

    /**
     * Inserta candidatos en estado PENDING con batch_id y file_path.
     * @param {Array<Object>} candidatesList - Lista de candidatos pendientes
     */
    async createPendingCandidates(candidatesList) {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        const currentUser = await this.getCurrentUser();
        const payload = candidatesList.map(cand => ({
            ...cand,
            ...(currentUser ? { user_id: currentUser.id } : {})
        }));

        telemetry.info(`Registrando ${payload.length} candidato(s) en estado PENDING...`, 'SUPABASE');
        const { data, error } = await client
            .from('candidates')
            .insert(payload);

        if (error) {
            telemetry.error(`Error al registrar candidatos pendientes: ${error.message}`, 'SUPABASE');
            throw error;
        }

        telemetry.success(`${candidatesList.length} candidato(s) registrados como PENDING`, 'SUPABASE');
        return data;
    }
}

export const supabaseService = new SupabaseService();