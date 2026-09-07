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

    async getVacantes() {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        telemetry.info('Consultando vacantes activas...', 'SUPABASE');
        const { data, error } = await client
            .from('vacantes')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            telemetry.error(`Error al cargar vacantes: ${error.message}`, 'SUPABASE');
            throw error;
        }

        telemetry.success(`${data ? data.length : 0} vacantes obtenidas con éxito`, 'SUPABASE');
        return data || [];
    }

    async getCandidatesByVacante(vacanteId) {
        const client = await this.getClient();
        if (!client) throw new Error('Cliente Supabase no inicializado');

        telemetry.info(`Consultando candidatos para vacante: ${vacanteId || 'TODAS'}`, 'SUPABASE');
        let query = client.from('candidates').select('*');

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

        telemetry.info(`Upserting candidato: ${candidate.name} (${candidate.email})`, 'SUPABASE');
        const { data, error } = await client
            .from('candidates')
            .upsert([candidate], { onConflict: 'email,vacante_id' });

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
}

export const supabaseService = new SupabaseService();