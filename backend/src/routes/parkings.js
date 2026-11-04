const { randomUUID } = require('crypto');
const express = require('express');
const { db } = require('../db');
const { validate, sendPage, inDateRange } = require('../http');
const { parkingBody, bulkBody, listQuery, deleteParkingsQuery } = require('../schemas');

const router = express.Router();

function buildParking(data) {
  return {
    id: randomUUID(),
    unit_id: data.unit_id,
    unit_name: data.unit_name,
    latitude: data.latitude,
    longitude: data.longitude,
    address: data.address,
    parking_duration: data.parking_duration,
    parking_start: data.parking_start,
    notes: data.notes,
    created_at: new Date().toISOString(),
  };
}

router.get('/', validate(listQuery, 'query'), (req, res) => {
  const { unit_id, from, to, limit, offset } = req.valid;
  const parkings = db.getParkings()
    .filter((p) => !unit_id || p.unit_id === unit_id)
    .filter((p) => inDateRange(p.parking_start || p.created_at, from, to))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  sendPage(res, parkings, { limit, offset });
});

router.get('/:id', (req, res) => {
  const parking = db.getParkings().find((p) => p.id === req.params.id);
  if (!parking) return res.status(404).json({ error: 'No encontrado' });
  res.json(parking);
});

router.post('/', validate(parkingBody), (req, res) => {
  const parking = buildParking(req.valid);
  db.saveParkings([...db.getParkings(), parking]);
  res.status(201).json(parking);
});

// Una fila inválida no detiene el resto: se informa en `failed`
router.post('/bulk', validate(bulkBody), (req, res) => {
  const created = [];
  const failed = [];

  for (const item of req.valid) {
    const result = parkingBody.safeParse(item);
    if (result.success) created.push(buildParking(result.data));
    else failed.push({ error: result.error.issues[0].message });
  }

  if (created.length > 0) db.saveParkings([...db.getParkings(), ...created]);
  res.status(201).json({ created, failed });
});

router.delete('/', validate(deleteParkingsQuery, 'query'), (req, res) => {
  const { unit_id } = req.valid;
  db.saveParkings(unit_id ? db.getParkings().filter((p) => p.unit_id !== unit_id) : []);
  res.json({ success: true, deleted: unit_id ? `unit:${unit_id}` : 'all' });
});

router.delete('/:id', (req, res) => {
  const parkings = db.getParkings();
  const remaining = parkings.filter((p) => p.id !== req.params.id);
  if (remaining.length === parkings.length) return res.status(404).json({ error: 'No encontrado' });
  db.saveParkings(remaining);
  res.json({ success: true });
});

module.exports = router;
