// Paleta categórica validada para daltonismo: el orden es parte de la validación.
// La identidad nunca depende solo del color: siempre va acompañada del nombre.
export const PALETTE = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#6250d6', '#e34948',
];

export const NEUTRAL = '#8a8983';

// Gráficas de una sola serie: un único color, la categoría ya la indica su etiqueta
export const CHART_COLOR = '#2a78d6';

// Cada sucursal conserva su color en todas las vistas
export const BRANCH_COLORS = {
  CARACAS: PALETTE[0], CENTRO: PALETTE[1], DIXON: PALETTE[2], GIBSON: PALETTE[3],
  MUELLE: PALETTE[4], SATUYE: PALETTE[5], TOCOA: PALETTE[6],
};

export const branchColor = (branch) => BRANCH_COLORS[branch] || NEUTRAL;

// Se ordena para que el color de cada unidad no dependa del orden de importación.
// Una flota puede superar los 8 colores: se repiten, y la unidad siempre lleva su nombre.
export function buildUnitColors(items) {
  const ids = [...new Set(items.map((item) => item.unit_id))].sort();
  const map = {};
  ids.forEach((id, i) => { map[id] = PALETTE[i % PALETTE.length]; });
  return map;
}
