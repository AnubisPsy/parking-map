import { z } from 'zod';

// Sin esto Zod prueba `new Function` para acelerarse, y la política CSP del servidor lo bloquea
z.config({ jitless: true });

// Contratos de la API. Validan solo los campos que usa la interfaz: los que no
// se declaran se descartan (por ejemplo, las copias completas dentro de /shares).

const optionalText = z.string().nullish();
const cell = z.union([z.string(), z.number()]).nullish();

export const parkingSchema = z.object({
  id: z.string(),
  unit_id: z.string(),
  unit_name: optionalText,
  latitude: z.number(),
  longitude: z.number(),
  address: optionalText,
  parking_duration: z.number().nullish(),
  parking_start: optionalText,
  notes: optionalText,
  track_id: optionalText,
  created_at: optionalText,
});

export const trackSchema = z.object({
  id: z.string(),
  unit_id: z.string(),
  unit_name: optionalText,
  address: optionalText,
  source_file: optionalText,
  start: z.string(),
  end: z.string(),
  points: z.array(z.object({ lat: z.number(), lng: z.number(), t: z.string() })),
  created_at: optionalText,
});

const dayRowSchema = z.object({
  date: optionalText,
  day: optionalText,
  vehicle_num: cell,
  plate: cell,
  branch: optionalText,
});

const observationSchema = dayRowSchema.extend({
  observation: optionalText,
  time: cell,
  duration: cell,
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
});

const voltageDropSchema = dayRowSchema.extend({
  unit_raw: optionalText,
  location: optionalText,
  time: cell,
});

const infractionSchema = z.object({
  agrupacion: optionalText,
  fecha: cell,
  date: optionalText,
  tipo: optionalText,
  sucursal: optionalText,
  infraccion: optionalText,
  duracion: cell,
  velocidad: z.number().nullish(),
  plate: cell,
  vehicle_num: cell,
});

const reportMetaSchema = z.object({
  id: z.string(),
  type: z.enum(['weekly', 'infractions']).nullish(),
  label: optionalText,
  week_label: optionalText,
  date_from: optionalText,
  date_to: optionalText,
  source_file: optionalText,
  created_at: optionalText,
});

export const reportSummarySchema = reportMetaSchema.extend({
  summary: z.object({
    observations: z.number().default(0),
    voltage_drops: z.number().default(0),
    non_deployed: z.number().default(0),
    late_departures: z.number().default(0),
    infractions: z.number().default(0),
  }),
});

export const reportSchema = reportMetaSchema.extend({
  observations: z.array(observationSchema).default([]),
  voltage_drops: z.array(voltageDropSchema).default([]),
  non_deployed: z.array(dayRowSchema).default([]),
  late_departures: z.array(dayRowSchema).default([]),
  infractions: z.array(infractionSchema).default([]),
});

export const shareSchema = z.object({
  id: z.string(),
  token: z.string(),
  type: z.string().nullish(),
  unit_ids: z.array(z.string()).nullish(),
  track_count: z.number().nullish(),
  expires_at: z.string(),
  created_at: z.string(),
});

export const shareDataSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('report'),
    expires_at: z.string(),
    report: reportSchema,
  }),
  z.object({
    type: z.literal('parking'),
    expires_at: z.string(),
    unit_ids: z.array(z.string()).nullish(),
    parkings: z.array(parkingSchema),
    tracks: z.array(trackSchema).default([]),
  }),
  z.object({
    type: z.literal('tracks'),
    expires_at: z.string(),
    tracks: z.array(trackSchema),
    parkings: z.array(parkingSchema),
  }),
]);

export const bulkResultSchema = z.object({
  created: z.array(parkingSchema),
  failed: z.array(z.object({ error: z.string().optional() })),
});

export const trackImportResultSchema = z.object({
  track: trackSchema,
  parkings: z.array(parkingSchema),
  replaced_track_id: z.string().nullish(),
  replaced_parking_ids: z.array(z.string()).default([]),
});

export const deleteTrackResultSchema = z.object({
  deleted_parking_ids: z.array(z.string()).default([]),
});

export const successSchema = z.object({ success: z.boolean().optional() });

export type Parking = z.infer<typeof parkingSchema>;
export type Track = z.infer<typeof trackSchema>;
export type ReportSummary = z.infer<typeof reportSummarySchema>;
export type Report = z.infer<typeof reportSchema>;
export type Share = z.infer<typeof shareSchema>;
export type ShareData = z.infer<typeof shareDataSchema>;
export type TrackImportResult = z.infer<typeof trackImportResultSchema>;
