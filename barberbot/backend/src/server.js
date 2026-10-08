import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ENV } from './config/environment.js';
import apiRoutes from './routes/apiRoutes.js';
import { workerInstance } from './services/queueWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger básico
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Rutas de API
app.use('/api', apiRoutes);

// Servir estáticos del frontend de BarberBot
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'BarberBot IA (Recepción IA)',
    services_status: {
      api: 'active',
      whatsapp_gateway: 'active',
      postgres_queue_worker: workerInstance.isRunning ? 'running' : 'idle'
    },
    timestamp: new Date().toISOString(),
    env: ENV.NODE_ENV
  });
});

// Manejador 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint no encontrado' });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('💥 Error no controlado:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    details: ENV.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = ENV.PORT;
app.listen(PORT, () => {
  console.log(`
========================================================================
💈 SaaS BarberBot IA (Recepción IA)
📡 1. API Service:           http://localhost:${PORT}/api
🚪 2. WhatsApp Gateway:      http://localhost:${PORT}/api/webhook/whatsapp
⚙️ 3. Postgres Queue Worker: Activo (1 turno/conversación, paralelo)
💻 Dashboard Frontend:       http://localhost:${PORT}/
========================================================================
  `);

  // Iniciar el Worker con Colas en Postgres
  workerInstance.start();
});

export default app;
