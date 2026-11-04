import { z } from 'zod';
import {
  bulkResultSchema,
  deleteTrackResultSchema,
  parkingSchema,
  reportSchema,
  reportSummarySchema,
  shareDataSchema,
  shareSchema,
  successSchema,
  trackImportResultSchema,
  trackSchema,
} from './schemas';

const BASE = '/api';

export class ApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestInit = {},
): Promise<z.output<S>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (err) {
    // La cancelación no es un error de red: TanStack Query la gestiona por su cuenta
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // Respuesta vacía o no-JSON: normalmente el backend no está corriendo
    throw new ApiError(
      `No se pudo conectar con el servidor (${res.status}). ¿Está corriendo el backend?`,
      res.status,
    );
  }

  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new ApiError(message || `Error ${res.status}`, res.status);
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('El servidor devolvió datos con un formato inesperado.', res.status);
  }
  return parsed.data;
}

function send<S extends z.ZodType>(path: string, schema: S, body: unknown) {
  return request(path, schema, { method: 'POST', body: JSON.stringify(body) });
}

function remove<S extends z.ZodType>(path: string, schema: S) {
  return request(path, schema, { method: 'DELETE' });
}

export const fetchParkings = (signal?: AbortSignal) =>
  request('/parkings', z.array(parkingSchema), { signal });

export const createParking = (body: unknown) => send('/parkings', parkingSchema, body);

export const createParkingsBulk = (items: unknown[]) =>
  send('/parkings/bulk', bulkResultSchema, items);

export const deleteParking = (id: string) => remove(`/parkings/${id}`, successSchema);

export const deleteParkingsByUnit = (unitId: string) =>
  remove(`/parkings?unit_id=${encodeURIComponent(unitId)}`, successSchema);

export const deleteAllParkings = () => remove('/parkings', successSchema);

export const createShareLink = (body: unknown) => send('/shares', shareSchema, body);

export const fetchShareData = (token: string, signal?: AbortSignal) =>
  request(`/shares/${token}`, shareDataSchema, { signal });

export const fetchShares = (signal?: AbortSignal) =>
  request('/shares', z.array(shareSchema), { signal });

export const deleteShare = (id: string) => remove(`/shares/${id}`, successSchema);

export const fetchReports = (signal?: AbortSignal) =>
  request('/reports', z.array(reportSummarySchema), { signal });

export const fetchReport = (id: string, signal?: AbortSignal) =>
  request(`/reports/${id}`, reportSchema, { signal });

export const createReport = (body: unknown) => send('/reports', reportSummarySchema, body);

export const deleteReport = (id: string) => remove(`/reports/${id}`, successSchema);

export const fetchTracks = (signal?: AbortSignal) =>
  request('/tracks', z.array(trackSchema), { signal });

export const createTrack = (body: unknown) => send('/tracks', trackImportResultSchema, body);

export const deleteTrack = (id: string) => remove(`/tracks/${id}`, deleteTrackResultSchema);
