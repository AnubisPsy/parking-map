// Paleta con contraste de al menos 4.5:1 con texto blanco
export const PALETTE = [
  '#2563eb', '#b91c1c', '#15803d', '#b45309', '#7c3aed',
  '#0e7490', '#be185d', '#4d7c0f', '#a16207', '#4338ca',
];

export const NEUTRAL = '#64748b';

export const BRANCH_COLORS = {
  CARACAS: '#2563eb', DIXON: '#15803d', MUELLE: '#b45309',
  TOCOA: '#7c3aed', SATUYE: '#0e7490', GIBSON: '#be185d', CENTRO: '#b91c1c',
};

export const branchColor = (branch) => BRANCH_COLORS[branch] || NEUTRAL;

export function buildUnitColors(items) {
  const ids = [...new Set(items.map((item) => item.unit_id))];
  const map = {};
  ids.forEach((id, i) => { map[id] = PALETTE[i % PALETTE.length]; });
  return map;
}
