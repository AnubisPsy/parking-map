const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PARKINGS_FILE = path.join(DATA_DIR, 'parkings.json');
const SHARES_FILE = path.join(DATA_DIR, 'shares.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function writeJson(filePath, data) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

const db = {
  getParkings: () => readJson(PARKINGS_FILE),
  saveParkings: (data) => writeJson(PARKINGS_FILE, data),
  getShares: () => readJson(SHARES_FILE),
  saveShares: (data) => writeJson(SHARES_FILE, data),
  getReports: () => readJson(REPORTS_FILE),
  saveReports: (data) => writeJson(REPORTS_FILE, data),
};

function initDb() {
  ensureDir();
  if (!fs.existsSync(PARKINGS_FILE)) writeJson(PARKINGS_FILE, []);
  if (!fs.existsSync(SHARES_FILE)) writeJson(SHARES_FILE, []);
  if (!fs.existsSync(REPORTS_FILE)) writeJson(REPORTS_FILE, []);
  console.log('Data directory ready at', DATA_DIR);
}

module.exports = { db, initDb };
