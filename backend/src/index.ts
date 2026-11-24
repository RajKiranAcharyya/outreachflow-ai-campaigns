import { app } from './app';
import { sendWorker } from './workers/sendWorker';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const WORKER_INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS || 5000);

const server = app.listen(PORT, () => {
  console.log(`[OutreachFlow] Server running on port ${PORT}`);
  console.log(`[OutreachFlow] OpenAPI docs available at http://localhost:${PORT}/api-docs`);

  // Start background queue worker
  sendWorker.start(WORKER_INTERVAL_MS);
  console.log(`[OutreachFlow] Background send worker active (interval: ${WORKER_INTERVAL_MS}ms)`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n[OutreachFlow] Shutting down gracefully...');
  sendWorker.stop();
  server.close(() => {
    console.log('[OutreachFlow] Server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
