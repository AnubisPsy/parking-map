const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  let data;
  try {
    data = await res.json();
  } catch {
    // Respuesta vacía o no-JSON: normalmente el backend no está corriendo
    throw new Error(`No se pudo conectar con el servidor (${res.status}). ¿Está corriendo el backend?`);
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const fetchParkings = () => request('/parkings');

export const createParking = (body) =>
  request('/parkings', { method: 'POST', body: JSON.stringify(body) });

export const createParkingsBulk = (items) =>
  request('/parkings/bulk', { method: 'POST', body: JSON.stringify(items) });

export const deleteParking = (id) =>
  request(`/parkings/${id}`, { method: 'DELETE' });

export const deleteParkingsByUnit = (unitId) =>
  request(`/parkings?unit_id=${encodeURIComponent(unitId)}`, { method: 'DELETE' });

export const deleteAllParkings = () =>
  request('/parkings', { method: 'DELETE' });

export const createShareLink = (body) =>
  request('/shares', { method: 'POST', body: JSON.stringify(body) });

export const fetchShareData = (token) => request(`/shares/${token}`);

export const fetchShares = () => request('/shares');

export const deleteShare = (id) =>
  request(`/shares/${id}`, { method: 'DELETE' });

export const fetchReports = () => request('/reports');

export const fetchReport = (id) => request(`/reports/${id}`);

export const createReport = (body) =>
  request('/reports', { method: 'POST', body: JSON.stringify(body) });

export const deleteReport = (id) =>
  request(`/reports/${id}`, { method: 'DELETE' });

export const fetchTracks = () => request('/tracks');

export const createTrack = (body) =>
  request('/tracks', { method: 'POST', body: JSON.stringify(body) });

export const deleteTrack = (id) =>
  request(`/tracks/${id}`, { method: 'DELETE' });
