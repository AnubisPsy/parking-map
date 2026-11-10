const { randomBytes, randomUUID } = require('crypto');
const express = require('express');
const { db } = require('../db');
const { validate, sendPage } = require('../http');
const { shareBody, pageQuery } = require('../schemas');

const router = express.Router();

// Las copias de datos solo hacen falta al abrir el enlace, no al listarlos
function toSummary(share) {
  return {
    id: share.id,
    token: share.token,
    type: share.type,
    unit_ids: share.unit_ids,
    ...(share.type === 'tracks' && { track_count: share.tracks_snapshot.length }),
    expires_at: share.expires_at,
    created_at: share.created_at,
  };
}

router.get('/', validate(pageQuery, 'query'), (req, res) => {
  const shares = db.getShares()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(toSummary);
  sendPage(res, shares, req.valid);
});

router.delete('/:id', (req, res) => {
  const shares = db.getShares();
  const remaining = shares.filter((s) => s.id !== req.params.id);
  if (remaining.length === shares.length) return res.status(404).json({ error: 'No encontrado' });
  db.saveShares(remaining);
  res.json({ success: true });
});

router.post('/', validate(shareBody), (req, res) => {
  const { unit_ids, expires_in_minutes, report_id, track_ids, exclude_track_ids } = req.valid;

  const token = randomBytes(20).toString('hex');
  const expiresAt = new Date(Date.now() + expires_in_minutes * 60 * 1000).toISOString();

  // Report share
  if (report_id) {
    const report = db.getReports().find((r) => r.id === report_id);
    if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });

    const share = {
      id: randomUUID(),
      token,
      type: 'report',
      report_snapshot: report,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };
    db.saveShares([...db.getShares(), share]);
    return res.status(201).json(toSummary(share));
  }

  // Reporte de recorridos: copia de los recorridos elegidos y de sus paradas
  if (track_ids) {
    const tracks = db.getTracks().filter((t) => track_ids.includes(t.id));
    if (!tracks.length) return res.status(404).json({ error: 'Recorrido no encontrado' });
    const ids = new Set(tracks.map((t) => t.id));
    const share = {
      id: randomUUID(),
      token,
      type: 'tracks',
      unit_ids: [...new Set(tracks.map((t) => t.unit_id))],
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      tracks_snapshot: tracks,
      snapshot: db.getParkings().filter((p) => ids.has(p.track_id)),
    };
    db.saveShares([...db.getShares(), share]);
    return res.status(201).json(toSummary(share));
  }

  // Parking share: las unidades pedidas, sin los recorridos excluidos ni sus paradas
  const excluded = new Set(exclude_track_ids);
  const snapshot = db.getParkings()
    .filter((p) => !unit_ids || unit_ids.includes(p.unit_id))
    .filter((p) => !p.track_id || !excluded.has(p.track_id));
  const tracksSnapshot = db.getTracks()
    .filter((t) => !unit_ids || unit_ids.includes(t.unit_id))
    .filter((t) => !excluded.has(t.id));

  const share = {
    id: randomUUID(),
    token,
    type: 'parking',
    unit_ids,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    snapshot,
    tracks_snapshot: tracksSnapshot,
  };

  db.saveShares([...db.getShares(), share]);
  res.status(201).json(toSummary(share));
});

router.get('/:token', (req, res) => {
  const share = db.getShares().find((s) => s.token === req.params.token);
  if (!share) return res.status(404).json({ error: 'Enlace no encontrado' });
  if (new Date(share.expires_at) < new Date()) {
    return res.status(410).json({ error: 'El enlace ha expirado' });
  }

  // Report share
  if (share.type === 'report' || share.report_snapshot) {
    return res.json({
      type: 'report',
      expires_at: share.expires_at,
      report: share.report_snapshot,
    });
  }

  if (share.type === 'tracks') {
    return res.json({
      type: 'tracks',
      expires_at: share.expires_at,
      tracks: share.tracks_snapshot,
      parkings: share.snapshot,
    });
  }

  // Parking share
  let parkings;
  if (share.snapshot) {
    parkings = [...share.snapshot];
  } else {
    const allParkings = db.getParkings();
    parkings = share.unit_ids
      ? allParkings.filter((p) => share.unit_ids.includes(p.unit_id))
      : allParkings;
  }

  res.json({
    type: 'parking',
    expires_at: share.expires_at,
    unit_ids: share.unit_ids,
    parkings: parkings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    tracks: share.tracks_snapshot || [],
  });
});

module.exports = router;
