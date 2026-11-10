import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// Al salir de la página durante una animación de zoom (el encuadre inicial, por
// ejemplo), Leaflet ejecuta después un cuadro pendiente sobre el mapa ya destruido
// y lanza "Cannot read properties of undefined (reading '_leaflet_pos')". Ese
// cuadro no se puede cancelar: al desmontar se deja sin efecto.
export default function MapUnmountGuard() {
  const map = useMap();
  useEffect(() => () => {
    map._animatingZoom = false;
    map._moveStart = () => map;
    map._animateZoom = () => map;
  }, [map]);
  return null;
}
