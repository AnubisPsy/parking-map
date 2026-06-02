const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const reports = db.getReports()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(r => ({
      id: r.id,
      week_label: r.week_label,
      date_from: r.date_from,
      date_to: r.date_to,
      source_file: r.source_file,
      created_at: r.created_at,
      summary: {
        observations: r.observations?.length || 0,
        voltage_drops: r.voltage_drops?.length || 0,
        non_deployed: r.non_deployed?.length || 0,
        late_departures: r.late_departures?.length || 0,
      },
    }));
  res.json(reports);
});

router.get('/:id', (req, res) => {
  const report = db.getReports().find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });
  res.json(report);
});

router.post('/', (req, res) => {
  const { week_label, date_from, date_to, source_file, observations, voltage_drops, non_deployed, late_departures } = req.body;

  if (!week_label || !date_from || !date_to) {
    return res.status(400).json({ error: 'week_label, date_from y date_to son requeridos' });
  }

  const report = {
    id: uuidv4(),
    week_label,
    date_from,
    date_to,
    source_file: source_file || null,
    created_at: new Date().toISOString(),
    observations: observations || [],
    voltage_drops: voltage_drops || [],
    non_deployed: non_deployed || [],
    late_departures: late_departures || [],
  };

  const reports = db.getReports();
  reports.push(report);
  db.saveReports(reports);

  res.status(201).json({
    id: report.id,
    week_label: report.week_label,
    date_from: report.date_from,
    date_to: report.date_to,
    created_at: report.created_at,
    summary: {
      voltage_drops: report.voltage_drops.length,
      non_deployed: report.non_deployed.length,
      late_departures: report.late_departures.length,
    },
  });
});

router.delete('/:id', (req, res) => {
  const reports = db.getReports();
  const idx = reports.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Reporte no encontrado' });
  reports.splice(idx, 1);
  db.saveReports(reports);
  res.json({ success: true });
});

module.exports = router;
