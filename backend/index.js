const config = require('./src/config');
const logger = require('./src/logger');
const { initDb } = require('./src/db');
const { createApp } = require('./src/app');

const SHUTDOWN_TIMEOUT_MS = 10_000;
const MEMORY_LOG_INTERVAL_MS = 15 * 60 * 1000;

// Tras un error no controlado el estado es incierto: el servicio de Windows reinicia limpio
function exitOnFatal(kind) {
  return (err) => {
    logger.fatal({ err }, kind);
    process.exit(1);
  };
}
process.on('uncaughtException', exitOnFatal('Excepción no controlada'));
process.on('unhandledRejection', exitOnFatal('Promesa rechazada sin controlar'));

initDb();

const server = createApp().listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Servidor iniciado');
});

setInterval(() => {
  const { heapUsed, rss } = process.memoryUsage();
  logger.info({ heapUsedMb: Math.round(heapUsed / 1048576), rssMb: Math.round(rss / 1048576) }, 'Uso de memoria');
}, MEMORY_LOG_INTERVAL_MS).unref();

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Apagando');

  const forceExit = setTimeout(() => {
    logger.error('El apagado superó el tiempo límite, se fuerza la salida');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(() => process.exit(0));
  server.closeIdleConnections();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
