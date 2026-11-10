import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Menú desplegable accesible: flechas para moverse, Esc para cerrar.
// `items`: { label, description?, icon?, onSelect, disabled?, danger? }
export default function Menu({ label, icon: Icon, buttonClass = 'btn btn-secondary', hideLabelOnSmall = false, iconOnly = false, items }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    rootRef.current.querySelector('[role=menuitem]:not(:disabled)')?.focus();

    function onMouseDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onMenuKeyDown(e) {
    const entries = [...rootRef.current.querySelectorAll('[role=menuitem]:not(:disabled)')];
    const index = entries.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      entries[(index + 1) % entries.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      entries[(index - 1 + entries.length) % entries.length]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="menu-root">
      <button
        ref={buttonRef}
        className={buttonClass}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={iconOnly || hideLabelOnSmall ? label : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {Icon && <Icon size={iconOnly ? 16 : 15} />}
        {!iconOnly && <span className={hideLabelOnSmall ? 'btn-label-optional' : undefined}>{label}</span>}
        {!iconOnly && <ChevronDown size={14} className={hideLabelOnSmall ? 'btn-label-optional' : undefined} />}
      </button>

      {open && (
        <div className="menu" role="menu" aria-label={label} onKeyDown={onMenuKeyDown}>
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              className={`menu-item${item.danger ? ' menu-item-danger' : ''}`}
              onClick={() => {
                // El foco vuelve al botón antes de que un modal lo guarde como punto de retorno
                close();
                item.onSelect();
              }}
            >
              {item.icon && <item.icon size={16} />}
              <span style={{ minWidth: 0 }}>
                <span className="menu-item-title">{item.label}</span>
                {item.description && <span className="menu-item-desc">{item.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
