export const DAY_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// [{ branch: 'CENTRO', count: 3 }, ...] de mayor a menor
export function countBy(rows, field, keyName = 'branch') {
  const counts = {};
  rows.forEach((row) => { counts[row[field]] = (counts[row[field]] || 0) + 1; });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ [keyName]: key, count }));
}

export function countByDay(rows) {
  const counts = Object.fromEntries(DAY_ORDER.map((d) => [d, 0]));
  rows.forEach((row) => { if (counts[row.day] !== undefined) counts[row.day]++; });
  return DAY_ORDER.map((d) => ({ day: d.slice(0, 3), count: counts[d] }));
}
