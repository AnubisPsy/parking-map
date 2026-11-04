const { randomUUID } = require('crypto');
const express = require('express');
const { db } = require('../db');
const { validate, sendPage } = require('../http');
const { reportBody, pageQuery } = require('../schemas');

const router = express.Router();

function buildSummary(r) {
  if (r.type === 'infractions') {
    return { infractions: r.infractions?.length || 0 };
  }
  return {
    observations: r.observations?.length || 0,
    voltage_drops: r.voltage_drops?.length || 0,
    non_deployed: r.non_deployed?.length || 0,
    late_departures: r.late_departures?.length || 0,
  };
}

router.get('/', validate(pageQuery, 'query'), (req, res) => {
  const reports = db.getReports()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((r) => ({
      id: r.id,
      type: r.type || 'weekly',
      label: r.label || r.week_label,
      week_label: r.week_label,
      date_from: r.date_from,
      date_to: r.date_to,
      source_file: r.source_file,
      created_at: r.created_at,
      summary: buildSummary(r),
    }));
  sendPage(res, reports, req.valid);
});

router.get('/:id', (req, res) => {
  const report = db.getReports().find((r) => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });
  res.json(report);
});

router.post('/', validate(reportBody), (req, res) => {
  const {
    type, label, week_label, date_from, date_to, source_file,
    observations, voltage_drops, non_deployed, late_departures, infractions,
  } = req.valid;

  const displayLabel = label || week_label;
  const report = {
    id: randomUUID(),
    type,
    label: displayLabel,
    week_label: displayLabel,
    date_from,
    date_to,
    source_file,
    created_at: new Date().toISOString(),
    ...(type === 'infractions'
      ? { infractions }
      : { observations, voltage_drops, non_deployed, late_departures }),
  };

  db.saveReports([...db.getReports(), report]);

  res.status(201).json({
    id: report.id,
    type: report.type,
    label: report.label,
    date_from: report.date_from,
    date_to: report.date_to,
    created_at: report.created_at,
    summary: buildSummary(report),
  });
});

router.delete('/:id', (req, res) => {
  const reports = db.getReports();
  const remaining = reports.filter((r) => r.id !== req.params.id);
  if (remaining.length === reports.length) return res.status(404).json({ error: 'Reporte no encontrado' });
  db.saveReports(remaining);
  res.json({ success: true });
});

module.exports = router;
