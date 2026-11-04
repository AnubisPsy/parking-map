const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const config = require('./config');
const logger = require('./logger');
const { checkDataDir } = require('./db');
const parkingsRouter = require('./routes/parkings');
const sharesRouter = require('./routes/shares');
const reportsRouter = require('./routes/reports');
const tracksRouter = require('./routes/tracks');

const DEFAULT_BODY_LIMIT = '1mb';
// Importaciones de Excel y recorridos GPS, que pueden traer miles de filas
const IMPORT_BODY_LIMIT = '20mb';

// El token de un enlace compartido da acceso a sus datos: no debe quedar en los logs
function maskTokens(url = '') {
  return url.replace(/(\/(?:api\/shares|map|report)\/)[^/?#]+/, '$1[oculto]');
}

function requestLogger() {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = crypto.randomBytes(4).toString('hex');
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === '/api/health' || req.url.startsWith('/assets/') },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      return res.statusCode >= 400 ? 'warn' : 'info';
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: maskTokens(req.url) }),
      res: (res) => ({ status: res.statusCode }),
    },
  });
}

function slowRequestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    if (ms >= config.SLOW_REQUEST_MS) req.log.warn({ ms }, 'Pedido lento');
  });
  next();
}

// Los mapas cargan mosaicos externos y React usa estilos en línea. El sistema se sirve
// por HTTP interno, por eso se desactivan las cabeceras que exigen HTTPS.
function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://*.google.com', 'https://*.tile.openstreetmap.org'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
  });
}

function healthRoute(req, res) {
  try {
    checkDataDir();
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  } catch (err) {
    req.log.error({ err }, 'Fallo la comprobación de salud');
    res.status(503).json({ status: 'error' });
  }
}

function serveFrontend(app) {
  const indexFile = path.join(config.FRONTEND_DIST, 'index.html');

  // Los archivos de /assets llevan un hash en el nombre y nunca cambian
  app.use('/assets', express.static(path.join(config.FRONTEND_DIST, 'assets'), {
    immutable: true,
    maxAge: '1y',
    fallthrough: false,
  }));
  app.use(express.static(config.FRONTEND_DIST, { index: false, maxAge: '1d' }));

  app.get('*', (req, res, next) => {
    if (!fs.existsSync(indexFile)) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    req.log.error({ err }, 'Error no controlado');
    return res.status(500).json({ error: `Error interno del servidor. Código: ${req.id}` });
  }
  if (status === 413) return res.status(413).json({ error: 'El contenido enviado es demasiado grande' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El contenido enviado no es JSON válido' });
  if (status === 404) return res.status(404).json({ error: 'Recurso no encontrado' });
  res.status(status).json({ error: err.message });
}

function createApp() {
  const app = express();

  app.use(requestLogger());
  app.use(slowRequestLogger);
  app.use(securityHeaders());
  app.use(compression());

  // El frontend se sirve desde este mismo origen y en desarrollo usa el proxy de Vite.
  // CORS solo se abre si se configura un origen explícito, nunca para cualquiera.
  if (config.FRONTEND_URL) app.use(cors({ origin: config.FRONTEND_URL }));

  const importBody = express.json({ limit: IMPORT_BODY_LIMIT });
  app.use('/api/tracks', importBody);
  app.use('/api/reports', importBody);
  app.use('/api/parkings/bulk', importBody);
  app.use(express.json({ limit: DEFAULT_BODY_LIMIT }));

  app.get('/api/health', healthRoute);
  app.use('/api/parkings', parkingsRouter);
  app.use('/api/shares', sharesRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/tracks', tracksRouter);
  app.use('/api', notFound);

  serveFrontend(app);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, maskTokens };
