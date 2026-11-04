const fs = require('fs');
const path = require('path');
const pino = require('pino');
const config = require('./config');

const FILE_PATTERN = /^app-(\d{4}-\d{2}-\d{2})\.log$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// Un archivo por día con limpieza de los antiguos. La escritura es síncrona para
// que el último error no se pierda cuando el proceso termina tras un fallo fatal.
function createDailyFile(dir, retentionDays) {
  fs.mkdirSync(dir, { recursive: true });
  let currentDay = null;
  let fd = null;

  function prune(today) {
    const limit = Date.parse(today) - retentionDays * DAY_MS;
    for (const name of fs.readdirSync(dir)) {
      const match = name.match(FILE_PATTERN);
      if (match && Date.parse(match[1]) < limit) fs.rmSync(path.join(dir, name), { force: true });
    }
  }

  return {
    write(line) {
      const today = new Date().toISOString().slice(0, 10);
      if (today !== currentDay) {
        if (fd !== null) fs.closeSync(fd);
        fd = fs.openSync(path.join(dir, `app-${today}.log`), 'a');
        currentDay = today;
        prune(today);
      }
      fs.writeSync(fd, line);
    },
  };
}

const streams = config.LOG_LEVEL === 'silent'
  ? []
  : [
      { level: config.LOG_LEVEL, stream: createDailyFile(config.LOG_DIR, config.LOG_RETENTION_DAYS) },
      { level: config.LOG_LEVEL, stream: process.stdout },
    ];

const logger = pino(
  {
    level: config.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ['password', 'token', 'authorization', '*.password', '*.token', '*.authorization'],
      censor: '[oculto]',
    },
  },
  pino.multistream(streams),
);

module.exports = logger;
