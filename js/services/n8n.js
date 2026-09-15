/**
 * TalentOS - n8n Webhook Service
 * Handles uploading CV PDFs to the automation workflow.
 */

import { CONFIG } from '../config.js';
import { telemetry } from './telemetry.js';

class N8nService {
    /**
     * Notifica a n8n para iniciar el procesamiento asíncrono del lote.
     * Envía un JSON con { batch_id: batchId }.
     * @param {string} batchId - Identificador único del lote
     * @returns {Promise<{success: boolean, status?: number, latency: number}>}
     */
    async notifyBatchProcessing(batchId) {
        if (!batchId) throw new Error('Se requiere un batchId para notificar a n8n');

        telemetry.info(`Notificando a n8n lote de procesamiento: ${batchId}...`, 'N8N');

        try {
            const startTime = performance.now();
            const response = await fetch(CONFIG.N8N.CV_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ batch_id: batchId })
            });

            const latency = Math.round(performance.now() - startTime);

            if (response.ok) {
                telemetry.success(`Webhook n8n notificado con éxito para lote ${batchId} (${latency}ms)`, 'N8N');
                return { success: true, latency };
            } else {
                telemetry.error(`Webhook n8n respondió con status ${response.status} (${response.statusText})`, 'N8N');
                return { success: false, status: response.status, latency };
            }
        } catch (err) {
            telemetry.error(`Error de red al notificar webhook n8n: ${err.message}`, 'N8N');
            throw err;
        }
    }

    // Alias para compatibilidad hacia atrás si algún módulo invoca uploadCv
    async uploadCv(fileOrBatchId, vacanteId) {
        if (typeof fileOrBatchId === 'string') {
            return this.notifyBatchProcessing(fileOrBatchId);
        }
        throw new Error('El método directo uploadCv con archivos ha sido reemplazado por la arquitectura asíncrona notifyBatchProcessing(batchId).');
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
