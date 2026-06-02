const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const parkings = db.getParkings();
  res.json(parkings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

router.get('/:id', (req, res) => {
  const parking = db.getParkings().find(p => p.id === req.params.id);
  if (!parking) return res.status(404).json({ error: 'No encontrado' });
  res.json(parking);
});

router.post('/', (req, res) => {
  const { unit_id, unit_name, latitude, longitude, address, parking_duration, parking_start, notes } = req.body;

  if (!unit_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'unit_id, latitude y longitude son requeridos' });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (isNaN(lat) || lat < -90 || lat > 90) return res.status(400).json({ error: 'Latitud inválida (-90 a 90)' });
  if (isNaN(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: 'Longitud inválida (-180 a 180)' });

  const parking = {
    id: uuidv4(),
    unit_id: unit_id.trim(),
    unit_name: unit_name?.trim() || null,
    latitude: lat,
    longitude: lng,
    address: address?.trim() || null,
    parking_duration: parking_duration ? parseInt(parking_duration) : null,
    parking_start: parking_start || null,
    notes: notes?.trim() || null,
    created_at: new Date().toISOString(),
  };

  const parkings = db.getParkings();
  parkings.push(parking);
  db.saveParkings(parkings);

  res.status(201).json(parking);
});

router.post('/bulk', (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se esperaba un array no vacío' });
  }

  const parkings = db.getParkings();
  const created = [];
  const failed = [];

  for (const item of items) {
    const { unit_id, unit_name, latitude, longitude, address, parking_duration, parking_start, notes } = item;
    if (!unit_id || latitude === undefined || longitude === undefined) {
      failed.push({ error: 'unit_id, latitude y longitude son requeridos' });
      continue;
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      failed.push({ error: 'Coordenadas inválidas' });
      continue;
    }
    const parking = {
      id: uuidv4(),
      unit_id: unit_id.trim(),
      unit_name: unit_name?.trim() || null,
      latitude: lat,
      longitude: lng,
      address: address?.trim() || null,
      parking_duration: parking_duration ? parseInt(parking_duration) : null,
      parking_start: parking_start || null,
      notes: notes?.trim() || null,
      created_at: new Date().toISOString(),
    };
    parkings.push(parking);
    created.push(parking);
  }

  if (created.length > 0) db.saveParkings(parkings);
  res.status(201).json({ created, failed });
});

router.delete('/', (req, res) => {
  const { unit_id } = req.query;
  let parkings = db.getParkings();
  parkings = unit_id ? parkings.filter(p => p.unit_id !== unit_id) : [];
  db.saveParkings(parkings);
  res.json({ success: true, deleted: unit_id ? `unit:${unit_id}` : 'all' });
});

router.delete('/:id', (req, res) => {
  const parkings = db.getParkings();
  const idx = parkings.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  parkings.splice(idx, 1);
  db.saveParkings(parkings);
  res.json({ success: true });
});

module.exports = router;
