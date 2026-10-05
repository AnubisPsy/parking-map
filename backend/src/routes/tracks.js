const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const router = express.Router();

function validCoords(lat, lng) {
  return !isNaN(lat) && lat >= -90 && lat <= 90 && !isNaN(lng) && lng >= -180 && lng <= 180;
}

router.get('/', (req, res) => {
  const tracks = db.getTracks();
  res.json(tracks.sort((a, b) => new Date(b.start) - new Date(a.start)));
});

// Crea un recorrido (puntos de la hoja "Rastro") junto con sus estacionamientos.
// Si ya existe un recorrido de la misma unidad con el mismo rango de horas, se reemplaza
// (incluyendo sus estacionamientos) para que reimportar el archivo no duplique datos.
router.post('/', (req, res) => {
  const { unit_id, unit_name, address, source_file, points, stops = [] } = req.body;

  if (!unit_id || !Array.isArray(points)) {
    return res.status(400).json({ error: 'unit_id y points son requeridos' });
  }

  const cleanPoints = points
    .map(p => ({ lat: parseFloat(p.lat), lng: parseFloat(p.lng), t: p.t }))
    .filter(p => validCoords(p.lat, p.lng) && p.t && !isNaN(new Date(p.t)))
    .sort((a, b) => new Date(a.t) - new Date(b.t));

  if (cleanPoints.length < 2) {
    return res.status(400).json({ error: 'El recorrido necesita al menos 2 puntos válidos' });
  }

  const start = cleanPoints[0].t;
  const end = cleanPoints[cleanPoints.length - 1].t;
  const unitId = String(unit_id).trim();

  let tracks = db.getTracks();
  let parkings = db.getParkings();

  const existing = tracks.find(t => t.unit_id === unitId && t.start === start && t.end === end);
  const replacedParkingIds = [];
  if (existing) {
    tracks = tracks.filter(t => t.id !== existing.id);
    parkings = parkings.filter(p => {
      if (p.track_id !== existing.id) return true;
      replacedParkingIds.push(p.id);
      return false;
    });
  }

  const track = {
    id: uuidv4(),
    unit_id: unitId,
    unit_name: unit_name?.trim() || null,
    address: address?.trim() || null,
    source_file: source_file || null,
    start,
    end,
    points: cleanPoints,
    created_at: new Date().toISOString(),
  };

  const createdParkings = [];
  for (const s of stops) {
    const lat = parseFloat(s.latitude);
    const lng = parseFloat(s.longitude);
    if (!validCoords(lat, lng)) continue;
    createdParkings.push({
      id: uuidv4(),
      unit_id: unitId,
      unit_name: track.unit_name,
      latitude: lat,
      longitude: lng,
      address: s.address?.trim() || track.address,
      parking_duration: s.parking_duration ? parseInt(s.parking_duration) : null,
      parking_start: s.parking_start || null,
      notes: null,
      track_id: track.id,
      created_at: new Date().toISOString(),
    });
  }

  tracks.push(track);
  parkings.push(...createdParkings);
  db.saveTracks(tracks);
  db.saveParkings(parkings);

  res.status(201).json({
    track,
    parkings: createdParkings,
    replaced_track_id: existing?.id || null,
    replaced_parking_ids: replacedParkingIds,
  });
});

// Elimina el recorrido y los estacionamientos que se importaron con él
router.delete('/:id', (req, res) => {
  const tracks = db.getTracks();
  const idx = tracks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  tracks.splice(idx, 1);
  db.saveTracks(tracks);

  const parkings = db.getParkings();
  const deletedParkingIds = parkings.filter(p => p.track_id === req.params.id).map(p => p.id);
  if (deletedParkingIds.length > 0) {
    db.saveParkings(parkings.filter(p => p.track_id !== req.params.id));
  }

  res.json({ success: true, deleted_parking_ids: deletedParkingIds });
});

module.exports = router;
