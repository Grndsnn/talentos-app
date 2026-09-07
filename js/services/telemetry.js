/**
 * TalentOS - Telemetry & Event Logger Service
 * Captures live network calls, state changes and errors for Debugger agent.
 */

class TelemetryService {
    constructor() {
        this.logs = [];
        this.subscribers = [];
        this.maxLogs = 150;
        this.setupInterceptors();
    }

    log(message, type = 'info', source = 'SYSTEM') {
        const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
        const entry = {
            id: Date.now() + Math.random(),
            time: timestamp,
            message,
            type,
            source
        };

        this.logs.unshift(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }

        // Notify subscribers
        this.subscribers.forEach(cb => {
            try { cb(entry, this.logs); } catch (e) { console.error('Telemetry subscriber error', e); }
        });

        // Also echo to native browser console
        const prefix = `[TalentOS:${source}]`;
        if (type === 'error') console.error(prefix, message);
        else if (type === 'warning') console.warn(prefix, message);
        else console.log(prefix, message);

        return entry;
    }

    info(msg, source = 'APP') { return this.log(msg, 'info', source); }
    success(msg, source = 'APP') { return this.log(msg, 'success', source); }
    warn(msg, source = 'APP') { return this.log(msg, 'warning', source); }
    error(msg, source = 'APP') { return this.log(msg, 'error', source); }

    getLogs() {
        return [...this.logs];
    }

    clear() {
        this.logs = [];
        this.subscribers.forEach(cb => cb(null, []));
    }

    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    setupInterceptors() {
        // Intercept uncaught errors
        window.addEventListener('error', (event) => {
            this.error(`Error no controlado: ${event.message} (${event.filename}:${event.lineno})`, 'WINDOW');
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.error(`Promesa rechazada no controlada: ${event.reason}`, 'ASYNC');
        });
    }
}

export const telemetry = new TelemetryService();
