const { z } = require('zod');

const MAX_BULK_ITEMS = 50_000;
const MAX_REPORT_ROWS = 200_000;
const MAX_TRACK_POINTS = 500_000;

const emptyToNull = (value) => (value === undefined || value === '' ? null : value);
const numberToText = (value) => (typeof value === 'number' ? String(value) : value);

const REQUIRED_PARKING = 'unit_id, latitude y longitude son requeridos';

const coordinate = (min, max, invalid) => z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    return typeof value === 'string' ? parseFloat(value) : value;
  },
  z.number({ error: (issue) => (issue.input === undefined ? REQUIRED_PARKING : invalid) })
    .min(min, invalid)
    .max(max, invalid),
);

const latitude = coordinate(-90, 90, 'Latitud inválida (-90 a 90)');
const longitude = coordinate(-180, 180, 'Longitud inválida (-180 a 180)');

const optionalText = (max) => z.preprocess(
  (value) => numberToText(value) ?? null,
  z.string().max(max).trim().nullable().transform((text) => text || null),
);

const unitId = (message) => z.preprocess(
  numberToText,
  z.string({ error: message }).trim().min(1, message).max(100),
);

const duration = z.preprocess(
  (value) => (value ? parseInt(value, 10) : null),
  z.number().int().min(0).nullable(),
);

const dateTime = z.preprocess(
  emptyToNull,
  z.string()
    .max(40)
    .refine((text) => !Number.isNaN(new Date(text).getTime()), 'Fecha de inicio inválida')
    .nullable(),
);

const stopFields = {
  latitude,
  longitude,
  address: optionalText(300),
  parking_duration: duration,
  parking_start: dateTime,
};

const parkingBody = z.object({
  unit_id: unitId(REQUIRED_PARKING),
  unit_name: optionalText(200),
  notes: optionalText(2000),
  ...stopFields,
});

const stop = z.object(stopFields);

const bulkBody = z.array(z.unknown(), { error: 'Se esperaba un array no vacío' })
  .min(1, 'Se esperaba un array no vacío')
  .max(MAX_BULK_ITEMS, `Se admiten hasta ${MAX_BULK_ITEMS} registros por envío`);

const trackBody = z.object({
  unit_id: unitId('unit_id y points son requeridos'),
  unit_name: optionalText(200),
  address: optionalText(300),
  source_file: optionalText(300),
  points: z.array(z.unknown(), { error: 'unit_id y points son requeridos' }).max(MAX_TRACK_POINTS),
  stops: z.array(z.unknown()).max(MAX_BULK_ITEMS).default([]),
});

const REQUIRED_REPORT = 'label, date_from y date_to son requeridos';
const reportDate = z.string({ error: REQUIRED_REPORT }).regex(/^\d{4}-\d{2}-\d{2}/, REQUIRED_REPORT);
const reportRows = z.array(z.looseObject({})).max(MAX_REPORT_ROWS).default([]);

const reportBody = z.object({
  type: z.enum(['weekly', 'infractions']).default('weekly'),
  label: optionalText(200),
  week_label: optionalText(200),
  date_from: reportDate,
  date_to: reportDate,
  source_file: optionalText(300),
  observations: reportRows,
  voltage_drops: reportRows,
  non_deployed: reportRows,
  late_departures: reportRows,
  infractions: reportRows,
}).refine((report) => report.label || report.week_label, REQUIRED_REPORT);

const shareBody = z.object({
  unit_ids: z.array(z.string().max(100)).max(10_000).nullish().transform((ids) => ids ?? null),
  report_id: z.string().max(100).nullish().transform((id) => id ?? null),
  expires_in_minutes: z.coerce.number({ error: 'expires_in_minutes debe ser entre 1 y 10080 (7 días)' })
    .int('expires_in_minutes debe ser entre 1 y 10080 (7 días)')
    .min(1, 'expires_in_minutes debe ser entre 1 y 10080 (7 días)')
    .max(10080, 'expires_in_minutes debe ser entre 1 y 10080 (7 días)')
    .default(60),
});

const paging = {
  limit: z.coerce.number().int().min(1).max(5000).optional(),
  offset: z.coerce.number().int().min(0).default(0),
};

const dateFilter = z.string()
  .refine((text) => !Number.isNaN(new Date(text).getTime()), 'Fecha inválida')
  .optional();

const listQuery = z.object({
  unit_id: z.string().max(100).optional(),
  from: dateFilter,
  to: dateFilter,
  ...paging,
});

const pageQuery = z.object(paging);

const deleteParkingsQuery = z.object({ unit_id: z.string().max(100).optional() });

module.exports = {
  parkingBody,
  stop,
  bulkBody,
  trackBody,
  reportBody,
  shareBody,
  listQuery,
  pageQuery,
  deleteParkingsQuery,
};
