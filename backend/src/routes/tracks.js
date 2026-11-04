const { randomUUID } = require('crypto');
const express = require('express');
const { db } = require('../db');
const { validate, sendPage, inDateRange } = require('../http');
const { stop, trackBody, listQuery } = require('../schemas');

const router = express.Router();

function validCoords(lat, lng) {
  return !isNaN(lat) && lat >= -90 && lat <= 90 && !isNaN(lng) && lng >= -180 && lng <= 180;
}

router.get('/', validate(listQuery, 'query'), (req, res) => {
  const { unit_id, from, to, limit, offset } = req.valid;
  const tracks = db.getTracks()
    .filter((t) => !unit_id || t.unit_id === unit_id)
    // Se incluye el recorrido si se traslapa con el rango
    .filter((t) => inDateRange(t.end, from, undefined) && inDateRange(t.start, undefined, to))
    .sort((a, b) => new Date(b.start) - new Date(a.start));
  sendPage(res, tracks, { limit, offset });
});

// Crea un recorrido (puntos de la hoja "Rastro") junto con sus estacionamientos.
// Si ya existe un recorrido de la misma unidad con el mismo rango de horas, se reemplaza
// (incluyendo sus estacionamientos) para que reimportar el archivo no duplique datos.
router.post('/', validate(trackBody), (req, res) => {
  const { unit_id: unitId, unit_name, address, source_file, points, stops } = req.valid;

  const cleanPoints = points
    .map((p) => ({ lat: parseFloat(p?.lat), lng: parseFloat(p?.lng), t: p?.t }))
    .filter((p) => validCoords(p.lat, p.lng) && p.t && !isNaN(new Date(p.t)))
    .sort((a, b) => new Date(a.t) - new Date(b.t));

  if (cleanPoints.length < 2) {
    return res.status(400).json({ error: 'El recorrido necesita al menos 2 puntos válidos' });
  }

  const start = cleanPoints[0].t;
  const end = cleanPoints[cleanPoints.length - 1].t;

  let tracks = db.getTracks();
  let parkings = db.getParkings();

  const existing = tracks.find((t) => t.unit_id === unitId && t.start === start && t.end === end);
  const replacedParkingIds = [];
  if (existing) {
    tracks = tracks.filter((t) => t.id !== existing.id);
    parkings = parkings.filter((p) => {
      if (p.track_id !== existing.id) return true;
      replacedParkingIds.push(p.id);
      return false;
    });
  }

  const track = {
    id: randomUUID(),
    unit_id: unitId,
    unit_name,
    address,
    source_file,
    start,
    end,
    points: cleanPoints,
    created_at: new Date().toISOString(),
  };

  // Una parada con coordenadas inválidas se omite sin rechazar el recorrido
  const createdParkings = stops.flatMap((item) => {
    const result = stop.safeParse(item);
    if (!result.success) return [];
    return [{
      id: randomUUID(),
      unit_id: unitId,
      unit_name: track.unit_name,
      latitude: result.data.latitude,
      longitude: result.data.longitude,
      address: result.data.address || track.address,
      parking_duration: result.data.parking_duration,
      parking_start: result.data.parking_start,
      notes: null,
      track_id: track.id,
      created_at: new Date().toISOString(),
    }];
  });

  db.saveTracks([...tracks, track]);
  db.saveParkings([...parkings, ...createdParkings]);

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
  const remaining = tracks.filter((t) => t.id !== req.params.id);
  if (remaining.length === tracks.length) return res.status(404).json({ error: 'No encontrado' });
  db.saveTracks(remaining);

  const parkings = db.getParkings();
  const deletedParkingIds = parkings.filter((p) => p.track_id === req.params.id).map((p) => p.id);
  if (deletedParkingIds.length > 0) {
    db.saveParkings(parkings.filter((p) => p.track_id !== req.params.id));
  }

  res.json({ success: true, deleted_parking_ids: deletedParkingIds });
});

module.exports = router;
