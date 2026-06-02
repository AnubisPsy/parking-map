const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const shares = db.getShares()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(shares);
});

router.delete('/:id', (req, res) => {
  const shares = db.getShares();
  const idx = shares.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  shares.splice(idx, 1);
  db.saveShares(shares);
  res.json({ success: true });
});

router.post('/', (req, res) => {
  const { unit_ids = null, expires_in_minutes = 60, report_id = null } = req.body;

  const mins = parseInt(expires_in_minutes);
  if (!mins || mins < 1 || mins > 10080) {
    return res.status(400).json({ error: 'expires_in_minutes debe ser entre 1 y 10080 (7 días)' });
  }

  const token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 8);
  const expiresAt = new Date(Date.now() + mins * 60 * 1000).toISOString();

  // Report share
  if (report_id) {
    const report = db.getReports().find(r => r.id === report_id);
    if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });

    const share = {
      id: uuidv4(),
      token,
      type: 'report',
      report_snapshot: report,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };
    const shares = db.getShares();
    shares.push(share);
    db.saveShares(shares);
    return res.status(201).json({ id: share.id, token: share.token, type: 'report', expires_at: share.expires_at, created_at: share.created_at });
  }

  // Parking share
  const allParkings = db.getParkings();
  const snapshot = Array.isArray(unit_ids)
    ? allParkings.filter(p => unit_ids.includes(p.unit_id))
    : allParkings;

  const share = {
    id: uuidv4(),
    token,
    type: 'parking',
    unit_ids: Array.isArray(unit_ids) ? unit_ids : null,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    snapshot,
  };

  const shares = db.getShares();
  shares.push(share);
  db.saveShares(shares);

  res.status(201).json({
    id: share.id,
    token: share.token,
    type: 'parking',
    unit_ids: share.unit_ids,
    expires_at: share.expires_at,
    created_at: share.created_at,
  });
});

router.get('/:token', (req, res) => {
  const share = db.getShares().find(s => s.token === req.params.token);
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

  // Parking share
  let parkings;
  if (share.snapshot) {
    parkings = share.snapshot;
  } else {
    const allParkings = db.getParkings();
    parkings = share.unit_ids
      ? allParkings.filter(p => share.unit_ids.includes(p.unit_id))
      : allParkings;
  }

  res.json({
    type: 'parking',
    expires_at: share.expires_at,
    unit_ids: share.unit_ids,
    parkings: parkings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  });
});

module.exports = router;
