const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

const ROOT = path.join(__dirname, '..');

// .env.production solo se usa en producción. Las variables ya definidas en el
// entorno (por ejemplo, las del servicio de Windows) tienen prioridad.
const productionFile = path.join(ROOT, '.env.production');
const envFile = process.env.NODE_ENV === 'production' && fs.existsSync(productionFile)
  ? productionFile
  : path.join(ROOT, '.env');
dotenv.config({ path: envFile, quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  // Solo hace falta si el frontend se sirve desde otro origen
  FRONTEND_URL: z.url().optional(),
  DATA_DIR: z.string().default(path.join(ROOT, 'data')),
  LOG_DIR: z.string().default(path.join(ROOT, 'logs')),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
  LOG_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
  FRONTEND_DIST: z.string().default(path.join(ROOT, '..', 'frontend', 'dist')),
  SLOW_REQUEST_MS: z.coerce.number().int().min(1).default(3000),
});

const parsed = schema.safeParse({ ...process.env, FRONTEND_URL: process.env.FRONTEND_URL || undefined });

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Configuración inválida en ${path.basename(envFile)}:\n${problems}`);
  process.exit(1);
}

module.exports = Object.freeze(parsed.data);
