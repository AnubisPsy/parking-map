const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
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
