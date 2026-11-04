const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parking-map-test-'));
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DATA_DIR = dataDir;
process.env.FRONTEND_DIST = path.join(dataDir, 'no-existe');
process.env.FRONTEND_URL = ''; // Definida y vacía: dotenv no la sobrescribe con la del .env

const request = require('supertest');
const { createApp, maskTokens } = require('../src/app');
const { db, initDb } = require('../src/db');

const app = createApp();
const validParking = { unit_id: 'V-1', latitude: 15.7, longitude: -86.8 };
const file = (name) => path.join(dataDir, `${name}.json`);

before(() => initDb());
after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
beforeEach(() => {
  for (const name of ['parkings', 'shares', 'reports', 'tracks']) fs.writeFileSync(file(name), '[]');
});

describe('estacionamientos', () => {
  test('crea y normaliza', async () => {
    const res = await request(app).post('/api/parkings')
      .send({ ...validParking, unit_id: '  V-1 ', latitude: '15.7', unit_name: '', parking_duration: '90' });
    assert.equal(res.status, 201);
    assert.equal(res.body.unit_id, 'V-1');
    assert.equal(res.body.latitude, 15.7);
    assert.equal(res.body.unit_name, null);
    assert.equal(res.body.parking_duration, 90);
    assert.equal(db.getParkings().length, 1);
  });

  for (const [name, body, message] of [
    ['sin unidad', { latitude: 1, longitude: 1 }, 'unit_id, latitude y longitude son requeridos'],
    ['sin latitud', { unit_id: 'V', longitude: 1 }, 'unit_id, latitude y longitude son requeridos'],
    ['latitud fuera de rango', { unit_id: 'V', latitude: 91, longitude: 1 }, 'Latitud inválida (-90 a 90)'],
    ['longitud no numérica', { unit_id: 'V', latitude: 1, longitude: 'x' }, 'Longitud inválida (-180 a 180)'],
    ['fecha inválida', { ...validParking, parking_start: 'ayer' }, 'Fecha de inicio inválida'],
  ]) {
    test(`rechaza ${name}`, async () => {
      const res = await request(app).post('/api/parkings').send(body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error, message);
      assert.equal(db.getParkings().length, 0);
    });
  }

  test('la importación masiva informa las filas inválidas sin detenerse', async () => {
    const res = await request(app).post('/api/parkings/bulk')
      .send([validParking, { unit_id: 'V-2' }, { ...validParking, unit_id: 'V-3' }]);
    assert.equal(res.status, 201);
    assert.equal(res.body.created.length, 2);
    assert.equal(res.body.failed.length, 1);
  });

  test('la importación masiva exige un array no vacío', async () => {
    for (const body of [[], {}]) {
      const res = await request(app).post('/api/parkings/bulk').send(body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Se esperaba un array no vacío');
    }
  });

  test('filtra y pagina con el total en la cabecera', async () => {
    await request(app).post('/api/parkings/bulk').send([
      { ...validParking, unit_id: 'A', parking_start: '2026-10-01T10:00:00Z' },
      { ...validParking, unit_id: 'A', parking_start: '2026-10-05T10:00:00Z' },
      { ...validParking, unit_id: 'B', parking_start: '2026-10-05T10:00:00Z' },
    ]);
    const byUnit = await request(app).get('/api/parkings?unit_id=A');
    assert.equal(byUnit.body.length, 2);

    const byDate = await request(app).get('/api/parkings?from=2026-10-03&to=2026-10-06');
    assert.equal(byDate.body.length, 2);

    const page = await request(app).get('/api/parkings?limit=1&offset=1');
    assert.equal(page.body.length, 1);
    assert.equal(page.headers['x-total-count'], '3');

    const bad = await request(app).get('/api/parkings?limit=0');
    assert.equal(bad.status, 400);
  });

  test('elimina por unidad, por id y todo', async () => {
    const { body } = await request(app).post('/api/parkings/bulk')
      .send([validParking, { ...validParking, unit_id: 'B' }, { ...validParking, unit_id: 'C' }]);
    await request(app).delete('/api/parkings?unit_id=V-1').expect(200);
    assert.equal(db.getParkings().length, 2);
    await request(app).delete(`/api/parkings/${body.created[1].id}`).expect(200);
    assert.equal(db.getParkings().length, 1);
    await request(app).delete('/api/parkings/no-existe').expect(404);
    await request(app).delete('/api/parkings').expect(200);
    assert.equal(db.getParkings().length, 0);
  });
});

describe('recorridos', () => {
  const track = {
    unit_id: 'V-1',
    points: [
      { lat: 15.7, lng: -86.8, t: '2026-10-01T10:10:00Z' },
      { lat: 15.8, lng: -86.9, t: '2026-10-01T10:00:00Z' },
      { lat: 999, lng: 0, t: '2026-10-01T10:05:00Z' },
    ],
    stops: [
      { latitude: 15.7, longitude: -86.8, parking_duration: 5, parking_start: '2026-10-01T10:05:00Z' },
      { latitude: 999, longitude: 0 },
    ],
  };

  test('descarta puntos y paradas inválidos y ordena por hora', async () => {
    const { status, body } = await request(app).post('/api/tracks').send(track);
    assert.equal(status, 201);
    assert.equal(body.track.points.length, 2);
    assert.equal(body.track.start, '2026-10-01T10:00:00Z');
    assert.equal(body.parkings.length, 1);
    assert.equal(body.parkings[0].track_id, body.track.id);
  });

  test('exige al menos dos puntos válidos', async () => {
    const res = await request(app).post('/api/tracks').send({ unit_id: 'V', points: [{ lat: 1, lng: 1, t: 'x' }] });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El recorrido necesita al menos 2 puntos válidos');
  });

  test('reimportar reemplaza el recorrido y sus paradas', async () => {
    const first = await request(app).post('/api/tracks').send(track);
    const second = await request(app).post('/api/tracks').send(track);
    assert.equal(second.body.replaced_track_id, first.body.track.id);
    assert.deepEqual(second.body.replaced_parking_ids, [first.body.parkings[0].id]);
    assert.equal(db.getTracks().length, 1);
    assert.equal(db.getParkings().length, 1);
  });

  test('eliminar el recorrido elimina sus paradas', async () => {
    const { body } = await request(app).post('/api/tracks').send(track);
    await request(app).post('/api/parkings').send(validParking);
    const res = await request(app).delete(`/api/tracks/${body.track.id}`);
    assert.deepEqual(res.body.deleted_parking_ids, [body.parkings[0].id]);
    assert.equal(db.getParkings().length, 1);
  });
});

describe('reportes', () => {
  const weekly = { label: 'Semana', date_from: '2026-10-01', date_to: '2026-10-07', voltage_drops: [{ day: 'Lunes' }] };

  test('crea con resumen y conserva las filas', async () => {
    const { status, body } = await request(app).post('/api/reports').send(weekly);
    assert.equal(status, 201);
    assert.equal(body.summary.voltage_drops, 1);
    const full = await request(app).get(`/api/reports/${body.id}`);
    assert.deepEqual(full.body.voltage_drops, [{ day: 'Lunes' }]);
    const list = await request(app).get('/api/reports');
    assert.equal(list.body[0].voltage_drops, undefined);
  });

  test('exige nombre y fechas', async () => {
    for (const body of [{ date_from: '2026-10-01', date_to: '2026-10-02' }, { label: 'x', date_from: null, date_to: '2026-10-02' }]) {
      const res = await request(app).post('/api/reports').send(body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'label, date_from y date_to son requeridos');
    }
  });

  test('rechaza un tipo desconocido', async () => {
    await request(app).post('/api/reports').send({ ...weekly, type: 'otro' }).expect(400);
  });
});

describe('enlaces compartidos', () => {
  test('el listado no incluye las copias de datos', async () => {
    await request(app).post('/api/parkings').send(validParking);
    await request(app).post('/api/shares').send({ expires_in_minutes: 10 }).expect(201);
    const { body } = await request(app).get('/api/shares');
    assert.equal(body.length, 1);
    assert.equal(body[0].snapshot, undefined);
    assert.equal(body[0].tracks_snapshot, undefined);
  });

  test('sirve la copia aunque cambien los datos originales', async () => {
    await request(app).post('/api/parkings').send(validParking);
    const { body: share } = await request(app).post('/api/shares').send({});
    await request(app).delete('/api/parkings').expect(200);
    const res = await request(app).get(`/api/shares/${share.token}`);
    assert.equal(res.body.type, 'parking');
    assert.equal(res.body.parkings.length, 1);
  });

  test('filtra por unidades', async () => {
    await request(app).post('/api/parkings/bulk').send([validParking, { ...validParking, unit_id: 'B' }]);
    const { body: share } = await request(app).post('/api/shares').send({ unit_ids: ['B'] });
    const res = await request(app).get(`/api/shares/${share.token}`);
    assert.deepEqual(res.body.parkings.map((p) => p.unit_id), ['B']);
  });

  test('comparte reportes y falla si no existen', async () => {
    const { body: report } = await request(app).post('/api/reports')
      .send({ label: 'x', date_from: '2026-10-01', date_to: '2026-10-02' });
    const { body: share } = await request(app).post('/api/shares').send({ report_id: report.id });
    const res = await request(app).get(`/api/shares/${share.token}`);
    assert.equal(res.body.type, 'report');
    await request(app).post('/api/shares').send({ report_id: 'no-existe' }).expect(404);
  });

  test('responde 410 al expirar y 404 si no existe', async () => {
    fs.writeFileSync(file('shares'), JSON.stringify([{
      id: '1', token: 'abc', type: 'parking', snapshot: [], expires_at: '2020-01-01T00:00:00Z', created_at: '2020-01-01T00:00:00Z',
    }]));
    await request(app).get('/api/shares/abc').expect(410);
    await request(app).get('/api/shares/otro').expect(404);
  });

  test('valida la vigencia', async () => {
    for (const expires_in_minutes of [0, 10081, 'x']) {
      await request(app).post('/api/shares').send({ expires_in_minutes }).expect(400);
    }
  });
});

describe('protección de los datos', () => {
  test('un archivo dañado produce un error y no se sobrescribe', async () => {
    const original = '[{"id":"1", dañado';
    fs.writeFileSync(file('parkings'), original);
    const read = await request(app).get('/api/parkings');
    assert.equal(read.status, 500);
    const write = await request(app).post('/api/parkings').send(validParking);
    assert.equal(write.status, 500);
    assert.equal(fs.readFileSync(file('parkings'), 'utf8'), original);
  });

  test('el error 500 no revela detalles e incluye un código', async () => {
    fs.writeFileSync(file('parkings'), '{');
    const res = await request(app).get('/api/parkings');
    assert.match(res.body.error, /^Error interno del servidor\. Código: [0-9a-f]{8}$/);
    assert.equal(res.headers['x-request-id'], res.body.error.split(': ')[1]);
  });

  test('la escritura no deja archivos temporales', async () => {
    await request(app).post('/api/parkings').send(validParking).expect(201);
    assert.deepEqual(fs.readdirSync(dataDir).filter((f) => f.endsWith('.tmp')), []);
  });

  test('detecta cambios externos en el archivo', async () => {
    assert.equal(db.getParkings().length, 0);
    fs.writeFileSync(file('parkings'), JSON.stringify([{ id: 'x', unit_id: 'E', created_at: '2026-01-01' }]));
    assert.equal(db.getParkings().length, 1);
  });

  test('modificar lo leído no altera los datos guardados', () => {
    fs.writeFileSync(file('parkings'), JSON.stringify([{ id: 'x' }]));
    db.getParkings().push({ id: 'y' });
    assert.equal(db.getParkings().length, 1);
  });
});

describe('infraestructura', () => {
  test('health responde sin detalles internos', async () => {
    const { status, body } = await request(app).get('/api/health');
    assert.equal(status, 200);
    assert.deepEqual(Object.keys(body).sort(), ['status', 'uptime']);
  });

  test('health avisa si los datos están dañados', async () => {
    fs.writeFileSync(file('parkings'), '{');
    await request(app).get('/api/health').expect(503);
  });

  test('una ruta de API desconocida responde 404 en JSON', async () => {
    const res = await request(app).get('/api/no-existe');
    assert.equal(res.status, 404);
    assert.ok(res.body.error);
  });

  test('JSON mal formado responde 400', async () => {
    const res = await request(app).post('/api/parkings')
      .set('Content-Type', 'application/json').send('{"a":');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El contenido enviado no es JSON válido');
  });

  test('aplica el límite general de tamaño y permite más en importaciones', async () => {
    const big = 'x'.repeat(1024 * 1024 + 10);
    const rejected = await request(app).post('/api/parkings').send({ ...validParking, notes: big });
    assert.equal(rejected.status, 413);
    const accepted = await request(app).post('/api/reports')
      .send({ label: 'x', date_from: '2026-10-01', date_to: '2026-10-02', voltage_drops: [{ nota: big }] });
    assert.equal(accepted.status, 201);
  });

  test('envía cabeceras de seguridad, sin X-Powered-By ni CORS abierto', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://otro-sitio.example');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.match(res.headers['content-security-policy'], /default-src 'self'/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });

  test('comprime las respuestas grandes', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ ...validParking, unit_id: `V-${i}` }));
    await request(app).post('/api/parkings/bulk').send(rows);
    const res = await request(app).get('/api/parkings').set('Accept-Encoding', 'gzip');
    assert.equal(res.headers['content-encoding'], 'gzip');
  });

  test('oculta los tokens en las URL de los logs', () => {
    assert.equal(maskTokens('/api/shares/abc123'), '/api/shares/[oculto]');
    assert.equal(maskTokens('/map/abc123?from=2026-01-01'), '/map/[oculto]?from=2026-01-01');
    assert.equal(maskTokens('/report/abc123'), '/report/[oculto]');
    assert.equal(maskTokens('/api/parkings/abc123'), '/api/parkings/abc123');
  });
});
