const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');

const DATA_DIR = config.DATA_DIR;
const PARKINGS_FILE = path.join(DATA_DIR, 'parkings.json');
const SHARES_FILE = path.join(DATA_DIR, 'shares.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const TRACKS_FILE = path.join(DATA_DIR, 'tracks.json');

const SLOW_IO_MS = 500;
const RENAME_RETRIES = 5;

// Contenido ya interpretado por archivo; se descarta si el archivo cambia en disco
const cache = new Map();

function logIfSlow(operation, filePath, startedAt) {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= SLOW_IO_MS) {
    logger.warn({ operation, file: path.basename(filePath), ms: elapsed }, 'Operación de datos lenta');
  }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const { mtimeMs, size } = fs.statSync(filePath);
  const cached = cache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs && cached.size === size) return [...cached.data];

  const startedAt = Date.now();
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (cause) {
    // Nunca se interpreta como lista vacía: la siguiente escritura borraría todos los datos
    throw new Error(`Archivo de datos dañado: ${path.basename(filePath)}`, { cause });
  }
  if (!Array.isArray(data)) throw new Error(`Formato inesperado en ${path.basename(filePath)}`);
  logIfSlow('lectura', filePath, startedAt);

  cache.set(filePath, { mtimeMs, size, data });
  return [...data];
}

// En Windows el antivirus o el indexador pueden retener el archivo un instante
function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code) || attempt >= RENAME_RETRIES) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * attempt);
    }
  }
}

// Escritura atómica: un corte a mitad deja intacto el archivo anterior
function writeJson(filePath, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const startedAt = Date.now();
  const tempPath = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    renameWithRetry(tempPath, filePath);
  } catch (err) {
    fs.rmSync(tempPath, { force: true });
    throw err;
  }
  cache.delete(filePath);
  logIfSlow('escritura', filePath, startedAt);
}

const db = {
  getParkings: () => readJson(PARKINGS_FILE),
  saveParkings: (data) => writeJson(PARKINGS_FILE, data),
  getShares: () => readJson(SHARES_FILE),
  saveShares: (data) => writeJson(SHARES_FILE, data),
  getReports: () => readJson(REPORTS_FILE),
  saveReports: (data) => writeJson(REPORTS_FILE, data),
  getTracks: () => readJson(TRACKS_FILE),
  saveTracks: (data) => writeJson(TRACKS_FILE, data),
};

function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const file of [PARKINGS_FILE, SHARES_FILE, REPORTS_FILE, TRACKS_FILE]) {
    if (!fs.existsSync(file)) writeJson(file, []);
  }
  logger.info({ dir: DATA_DIR }, 'Directorio de datos listo');
}

// Para /api/health: comprueba que se puede leer y escribir en el directorio
function checkDataDir() {
  fs.accessSync(DATA_DIR, fs.constants.R_OK | fs.constants.W_OK);
  db.getParkings();
}

module.exports = { db, initDb, checkDataDir };
