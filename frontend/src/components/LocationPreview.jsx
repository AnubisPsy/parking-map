const TILE = 256;

// Posición en píxeles del mundo para un zoom dado (proyección Web Mercator)
function project(lat, lng, zoom) {
  const scale = TILE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

// Vista satelital fija armada con los mosaicos que cubren el recuadro: no crea un mapa
// Leaflet por cada parada, así que aparece al instante al pasar el cursor.
export default function LocationPreview({ latitude, longitude, width = 280, height = 170, zoom = 17, label }) {
  const center = project(latitude, longitude, zoom);
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const tiles = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
      tiles.push({ tx, ty });
    }
  }

  return (
    <div className="location-preview" style={{ width, height }} role="img" aria-label={label}>
      {tiles.map(({ tx, ty }) => (
        <img
          key={`${tx}-${ty}`}
          src={`https://mt${(tx + ty) % 4}.google.com/vt/lyrs=y&x=${tx}&y=${ty}&z=${zoom}`}
          alt=""
          width={TILE}
          height={TILE}
          draggable={false}
          // Sin conexión o bloqueado: mejor el fondo neutro que el icono de imagen rota
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
          style={{ left: tx * TILE - left, top: ty * TILE - top }}
        />
      ))}
      <span className="location-pin" aria-hidden="true" />
    </div>
  );
}
