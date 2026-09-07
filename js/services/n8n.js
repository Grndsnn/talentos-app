/**
 * TalentOS - n8n Webhook Service
 * Handles uploading CV PDFs to the automation workflow.
 */

import { CONFIG } from '../config.js';
import { telemetry } from './telemetry.js';

class N8nService {
    async uploadCv(file, vacanteId) {
        if (!file) throw new Error('No se seleccionó ningún archivo');
        if (!vacanteId) throw new Error('Debe seleccionar una vacante antes de subir el CV');

        telemetry.info(`Iniciando envío de CV (${file.name}, ${(file.size / 1024).toFixed(1)} KB) a n8n...`, 'N8N');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('vacante_id', vacanteId);

        try {
            const startTime = performance.now();
            const response = await fetch(CONFIG.N8N.CV_WEBHOOK_URL, {
                method: 'POST',
                body: formData
            });

            const latency = Math.round(performance.now() - startTime);

            if (response.ok) {
                telemetry.success(`Webhook n8n procesó ${file.name} con éxito (${latency}ms)`, 'N8N');
                return { success: true, latency };
            } else {
                telemetry.error(`Webhook n8n respondió con status ${response.status} (${response.statusText})`, 'N8N');
                return { success: false, status: response.status, latency };
            }
        } catch (err) {
            telemetry.error(`Error de red al conectar con webhook n8n: ${err.message}`, 'N8N');
            throw err;
        }
    }

    async testWebhookConnectivity() {
        telemetry.info('Comprobando endpoint webhook de n8n...', 'N8N');
        const startTime = performance.now();
        try {
            // Send lightweight HEAD / OPTIONS test
            const res = await fetch(CONFIG.N8N.CV_WEBHOOK_URL, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            const latency = Math.round(performance.now() - startTime);
            telemetry.info(`Endpoint n8n respondió status: ${res.status} (${latency}ms)`, 'N8N');
            return { online: true, status: res.status, latency };
        } catch (err) {
            const latency = Math.round(performance.now() - startTime);
            telemetry.warn(`Prueba de conectividad a n8n: ${err.message}`, 'N8N');
            return { online: false, error: err.message, latency };
        }
    }
}

export const n8nService = new N8nService();
