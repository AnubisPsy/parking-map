import { Link, NavLink } from 'react-router-dom';
import { BarChart2, Map as MapIcon, Route } from 'lucide-react';

export function Brand({ asLink = true }) {
  const content = (
    <>
      <span className="brand-mark" aria-hidden="true">P</span>
      <span className="brand-name">Parking Map</span>
    </>
  );
  return asLink
    ? <Link to="/" className="brand">{content}</Link>
    : <span className="brand">{content}</span>;
}

// Encabezado de la aplicación privada: marca, secciones y acciones de la página
export default function AppHeader({ children }) {
  return (
    <header className="app-header">
      <Brand />
      <nav className="app-nav" aria-label="Secciones">
        <NavLink to="/" end><MapIcon size={15} /> Mapa</NavLink>
        <NavLink to="/recorridos"><Route size={15} /> Recorridos</NavLink>
        <NavLink to="/reports"><BarChart2 size={15} /> Reportes</NavLink>
      </nav>
      {children && <div className="header-actions">{children}</div>}
    </header>
  );
}

// Encabezado de las vistas compartidas: sin navegación hacia la parte privada,
// solo entre las secciones del mismo enlace (`nav`)
export function SharedHeader({ nav, children }) {
  return (
    <header className="app-header">
      <Brand asLink={false} />
      {nav && (
        <nav className="app-nav" aria-label="Secciones">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={label} to={to} end><Icon size={15} /> {label}</NavLink>
          ))}
        </nav>
      )}
      <div className="header-actions">{children}</div>
    </header>
  );
}

// Secciones de un mapa compartido; conservan las fechas y la agrupación del enlace
export function sharedMapNav(token, search) {
  return [
    { to: `/map/${token}${search}`, label: 'Mapa', icon: MapIcon },
    { to: `/map/${token}/recorridos${search}`, label: 'Recorridos', icon: Route },
  ];
}
