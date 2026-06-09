import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchParkings,
  deleteParkingsByUnit,
  deleteAllParkings,
  deleteParking,
} from "../api";
import MapView from "../components/MapView";
import ParkingForm from "../components/ParkingForm";
import { buildUnitColors } from "../components/ParkingList";
import ShareLinkModal from "../components/ShareLinkModal";
import ImportModal from "../components/ImportModal";
import SharesListModal from "../components/SharesListModal";
import {
  Link2,
  Upload,
  Plus,
  ParkingSquare,
  Trash2,
  List,
  CalendarDays,
  X,
  ChevronDown,
  MapPin,
  BarChart2,
  Info,
  LayoutGrid,
} from "lucide-react";
import { useConfirm } from "../components/ConfirmModal";

const GROUP_OPTIONS = [
  { id: "unit", label: "Unidad" },
  { id: "date", label: "Fecha" },
  { id: "address", label: "Sucursal" },
  { id: "date_unit", label: "Fecha + Unidad" },
];

const ALL_LABEL = {
  unit: "Todas las unidades",
  date: "Todas las fechas",
  address: "Todas las sucursales",
  date_unit: "Todos los registros",
};

const GROUP_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#be185d",
  "#15803d",
  "#b45309",
  "#4338ca",
];

// Flat groups for unit / date / address modes
function buildGroups(parkings, groupBy, unitColors) {
  const map = new Map();
  parkings.forEach((p) => {
    let key, label, color;
    const d = dateKey(p);
    switch (groupBy) {
      case "unit":
        key = p.unit_id;
        label = p.unit_name ? `${p.unit_name} (${p.unit_id})` : p.unit_id;
        color = unitColors[p.unit_id] || "#64748b";
        break;
      case "date":
        key = d || "sin-fecha";
        label = d
          ? new Date(d + "T12:00:00").toLocaleDateString("es-MX", {
              weekday: "long",
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "Sin fecha";
        color = "#2563eb";
        break;
      case "address":
        key = p.address || "sin-sucursal";
        label = p.address || "Sin sucursal";
        color = "#2563eb";
        break;
      default:
        return;
    }
    if (!map.has(key))
      map.set(key, {
        key,
        label,
        color,
        items: [],
        count: 0,
        unitId: p.unit_id,
      });
    map.get(key).items.push(p);
    map.get(key).count++;
  });

  const groups = [...map.values()];
  if (groupBy === "date" || groupBy === "address")
    groups.forEach((g, i) => {
      g.color = GROUP_COLORS[i % GROUP_COLORS.length];
    });
  if (groupBy === "date") groups.sort((a, b) => b.key.localeCompare(a.key));
  else groups.sort((a, b) => a.label.localeCompare(b.label));
  groups.forEach((g) =>
    g.items.sort(
      (a, b) =>
        new Date(a.parking_start || a.created_at || 0) -
        new Date(b.parking_start || b.created_at || 0),
    ),
  );
  return groups;
}

// Two-level groups: Fecha (top) → Unidad (sub) → registros
function buildDateUnitGroups(parkings, unitColors) {
  const dateMap = new Map();
  parkings.forEach((p) => {
    const d = dateKey(p);
    const dk = d || "sin-fecha";
    const dlabel = d
      ? new Date(d + "T12:00:00").toLocaleDateString("es-MX", {
          weekday: "long",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "Sin fecha";
    if (!dateMap.has(dk))
      dateMap.set(dk, {
        key: dk,
        label: dlabel,
        color: "#2563eb",
        count: 0,
        subgroups: new Map(),
      });
    const dg = dateMap.get(dk);
    dg.count++;
    const uk = `${dk}||${p.unit_id}`;
    if (!dg.subgroups.has(uk))
      dg.subgroups.set(uk, {
        key: uk,
        dateKey: dk,
        unitId: p.unit_id,
        label: p.unit_name ? `${p.unit_name} (${p.unit_id})` : p.unit_id,
        color: unitColors[p.unit_id] || "#64748b",
        items: [],
        count: 0,
      });
    const ug = dg.subgroups.get(uk);
    ug.items.push(p);
    ug.count++;
  });

  const groups = [...dateMap.values()].map((g, i) => ({
    ...g,
    color: GROUP_COLORS[i % GROUP_COLORS.length],
    subgroups: [...g.subgroups.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((sg) => ({
        ...sg,
        items: [...sg.items].sort(
          (a, b) =>
            new Date(a.parking_start || a.created_at || 0) -
            new Date(b.parking_start || b.created_at || 0),
        ),
      })),
  }));
  groups.sort((a, b) => b.key.localeCompare(a.key)); // newest first
  return groups;
}

function formatDuration(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const navigate = useNavigate();
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSharesList, setShowSharesList] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [highlightId, setHighlightId] = useState(null);
  const [groupBy, setGroupBy] = useState("unit");
  const [filterKey, setFilterKey] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState(new Set());
  const [tooltipParking, setTooltipParking] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(0);

  useEffect(() => {
    fetchParkings()
      .then(setParkings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const unitColors = useMemo(() => buildUnitColors(parkings), [parkings]);

  // Flat groups (unit/date/address) or two-level groups (date_unit)
  const groups = useMemo(
    () =>
      groupBy === "date_unit"
        ? buildDateUnitGroups(parkings, unitColors)
        : buildGroups(parkings, groupBy, unitColors),
    [parkings, groupBy, unitColors],
  );

  useEffect(() => {
    setFilterKey("all");
    setExpandedGroups(new Set());
    setExpandedSubgroups(new Set());
    setHighlightId(null);
    setFilterDateFrom("");
    setFilterDateTo("");
  }, [groupBy]);

  // Parkings shown on map based on current selection
  const groupFilteredParkings = useMemo(() => {
    if (filterKey === "all") return parkings;
    if (groupBy === "date_unit") {
      if (filterKey.includes("||")) {
        // Unit subgroup selected
        const [dk, uid] = filterKey.split("||");
        return parkings.filter((p) => dateKey(p) === dk && p.unit_id === uid);
      } else {
        // Date group selected
        return parkings.filter(
          (p) => (dateKey(p) || "sin-fecha") === filterKey,
        );
      }
    }
    const g = groups.find((g) => g.key === filterKey);
    return g ? g.items : parkings;
  }, [parkings, groups, filterKey, groupBy]);

  const visibleParkings = useMemo(() => {
    if (!filterDateFrom && !filterDateTo) return groupFilteredParkings;
    return groupFilteredParkings.filter((p) => {
      const k = dateKey(p);
      if (!k) return true;
      if (filterDateFrom && k < filterDateFrom) return false;
      if (filterDateTo && k > filterDateTo) return false;
      return true;
    });
  }, [groupFilteredParkings, filterDateFrom, filterDateTo]);

  function applyDateFilter(items) {
    if (!filterDateFrom && !filterDateTo) return items;
    return items.filter((p) => {
      const k = dateKey(p);
      if (!k) return true;
      if (filterDateFrom && k < filterDateFrom) return false;
      if (filterDateTo && k > filterDateTo) return false;
      return true;
    });
  }

  // Toggle flat group (unit / date / address modes)
  function toggleGroup(key) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setFilterKey("all");
        setHighlightId(null);
      } else {
        next.add(key);
        setFilterKey(key);
        setHighlightId(null);
      }
      return next;
    });
  }

  // Toggle top-level date group in date_unit mode
  function toggleDateGroup(key) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setExpandedSubgroups((prev2) => {
          const n2 = new Set(prev2);
          [...n2]
            .filter((k) => k.startsWith(key + "||"))
            .forEach((k) => n2.delete(k));
          return n2;
        });
        setFilterKey((fk) =>
          fk === key || fk.startsWith(key + "||") ? "all" : fk,
        );
        setHighlightId(null);
      } else {
        next.add(key);
        setFilterKey(key);
        setHighlightId(null);
      }
      return next;
    });
  }

  // Toggle unit subgroup in date_unit mode
  function toggleUnitSubgroup(subKey, parentDateKey) {
    setExpandedSubgroups((prev) => {
      const next = new Set(prev);
      if (next.has(subKey)) {
        next.delete(subKey);
        setFilterKey(parentDateKey);
        setHighlightId(null);
      } else {
        next.add(subKey);
        setFilterKey(subKey);
        setHighlightId(null);
      }
      return next;
    });
  }

  function handleAllGroups() {
    setFilterKey("all");
    setExpandedGroups(new Set());
    setExpandedSubgroups(new Set());
    setHighlightId(null);
  }

  function handleCreated(parking) {
    setParkings((prev) => [parking, ...prev]);
    setHighlightId(parking.id);
  }
  function handleImported(newParkings) {
    setParkings((prev) => [...newParkings, ...prev]);
    if (newParkings.length > 0) setHighlightId(newParkings[0].id);
  }

  async function handleDeleteGroup(e, group) {
    e.stopPropagation();
    const ok = await confirm({
      title: `¿Eliminar "${group.label}"?`,
      message: `Se eliminarán los ${group.count} registro${group.count !== 1 ? "s" : ""}. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    try {
      await deleteParkingsByUnit(group.unitId);
      setParkings((prev) => prev.filter((p) => p.unit_id !== group.unitId));
      setExpandedGroups((prev) => {
        const n = new Set(prev);
        n.delete(group.key);
        return n;
      });
      if (filterKey === group.key) setFilterKey("all");
      if (highlightId) setHighlightId(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteAll() {
    const ok = await confirm({
      title: "¿Eliminar todos los registros?",
      message: `Se eliminarán los ${parkings.length} registro${parkings.length !== 1 ? "s" : ""} de todas las unidades. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    try {
      await deleteAllParkings();
      setParkings([]);
      setFilterKey("all");
      setExpandedGroups(new Set());
      setExpandedSubgroups(new Set());
      setHighlightId(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteOne(e, id) {
    e.stopPropagation();
    const ok = await confirm({
      title: "¿Eliminar este registro?",
      message: "Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    try {
      await deleteParking(id);
      setParkings((prev) => prev.filter((p) => p.id !== id));
      if (highlightId === id) setHighlightId(null);
    } catch (err) {
      console.error(err);
    }
  }

  function handleSelect(id) {
    setHighlightId((prev) => (prev === id ? null : id));
  }

  function handleInfoEnter(e, p, color) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipParking({ ...p, _color: color });
    setTooltipPos(Math.max(8, Math.min(rect.top, window.innerHeight - 280)));
  }
  function handleInfoLeave() {
    setTooltipParking(null);
  }

  // Shared item card renderer
  function renderItem(p, idx, itemColor, showUnit, showDate, showAddress) {
    const isHighlighted = highlightId === p.id;
    const duration = formatDuration(p.parking_duration);
    const start = formatDate(p.parking_start);
    return (
      <div
        key={p.id}
        onClick={() => handleSelect(p.id)}
        style={{
          background: isHighlighted ? "#eff6ff" : "#f8fafc",
          border: `1px solid ${isHighlighted ? "#2563eb" : "#e2e8f0"}`,
          borderLeft: `3px solid ${itemColor}`,
          borderRadius: 8,
          padding: "8px 10px",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 4,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 3,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isHighlighted ? "#2563eb" : "#1e293b",
                }}
              >
                #{idx + 1}
              </span>
              {showUnit && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "white",
                    background: itemColor,
                    padding: "1px 6px",
                    borderRadius: 20,
                  }}
                >
                  {p.unit_name || p.unit_id}
                </span>
              )}
              {duration && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isHighlighted ? "#2563eb" : "#374151",
                  }}
                >
                  {duration}
                </span>
              )}
              {isHighlighted && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    color: "#2563eb",
                    fontWeight: 700,
                  }}
                >
                  ● en mapa
                </span>
              )}
            </div>
            {showDate && start && (
              <p style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>
                {start}
              </p>
            )}
            {showAddress && p.address && (
              <p
                style={{
                  fontSize: 10,
                  color: "#94a3b8",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <MapPin size={9} /> {p.address}
              </p>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexShrink: 0,
            }}
          >
            <span
              onMouseEnter={(e) => handleInfoEnter(e, p, itemColor)}
              onMouseLeave={handleInfoLeave}
              style={{
                color: "#cbd5e1",
                display: "flex",
                alignItems: "center",
                padding: "2px 4px",
                borderRadius: 4,
                cursor: "default",
              }}
            >
              <Info size={12} />
            </span>
            <button
              onClick={(e) => handleDeleteOne(e, p.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                padding: "2px 4px",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
              }}
              title="Eliminar"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ParkingSquare size={26} color="white" />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "white" }}>
              Parking Map
            </h1>
            <p style={{ fontSize: 12, color: "#93c5fd" }}>
              {parkings.length} registro{parkings.length !== 1 ? "s" : ""}
              {" · "}
              {groups.length} grupo{groups.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowShare(true)}
            style={{
              ...btnOutline,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            disabled={parkings.length === 0}
          >
            <Link2 size={14} /> Compartir mapa
          </button>
          <button
            onClick={() => setShowSharesList(true)}
            style={{
              ...btnOutline,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <List size={14} /> Mis enlaces
          </button>
          <button
            onClick={() => navigate("/reports")}
            style={{
              ...btnOutline,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <BarChart2 size={14} /> Reportes
          </button>
          <button
            onClick={() => setShowImport(true)}
            style={{
              ...btnOutline,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Upload size={14} /> Importar
          </button>
          <button
            onClick={() => setShowForm(true)}
            style={{
              ...btnWhite,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={14} /> Nuevo registro
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <aside style={sidebar}>
          {/* Header + group picker */}
          <div
            style={{
              padding: "10px 14px 8px",
              borderBottom: "1px solid #e2e8f0",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <LayoutGrid size={13} color="#94a3b8" />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#374151",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Agrupar por
                </span>
              </div>
              {parkings.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  style={{
                    background: "transparent",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    cursor: "pointer",
                    color: "#94a3b8",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    padding: "3px 8px",
                    fontFamily: "inherit",
                  }}
                  title="Borrar todos los registros"
                >
                  <Trash2 size={11} /> Borrar todo
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setGroupBy(opt.id)}
                  style={groupBy === opt.id ? groupPillActive : groupPill}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range filter */}
          {groupFilteredParkings.length > 0 && (
            <div
              style={{
                padding: "8px 16px 10px",
                borderBottom: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarDays
                  size={14}
                  color="#94a3b8"
                  style={{ flexShrink: 0 }}
                />
                <input
                  type="date"
                  value={filterDateFrom}
                  max={filterDateTo || undefined}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  style={dateInputStyle}
                  title="Desde"
                />
                <span style={{ fontSize: 12, color: "#94a3b8", flexShrink: 0 }}>
                  —
                </span>
                <input
                  type="date"
                  value={filterDateTo}
                  min={filterDateFrom || undefined}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  style={dateInputStyle}
                  title="Hasta"
                />
                {(filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => {
                      setFilterDateFrom("");
                      setFilterDateTo("");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#94a3b8",
                      display: "flex",
                      padding: 2,
                      flexShrink: 0,
                      borderRadius: 4,
                    }}
                    title="Quitar filtro"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {(filterDateFrom || filterDateTo) && (
                <p
                  style={{
                    fontSize: 11,
                    color: "#2563eb",
                    marginTop: 5,
                    fontWeight: 600,
                  }}
                >
                  {visibleParkings.length} registro
                  {visibleParkings.length !== 1 ? "s" : ""} en el rango
                </p>
              )}
            </div>
          )}

          {/* Accordion list */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {loading && (
              <div
                style={{
                  textAlign: "center",
                  padding: 40,
                  color: "#94a3b8",
                  fontSize: 13,
                }}
              >
                Cargando registros...
              </div>
            )}
            {error && (
              <div
                style={{
                  background: "#fef2f2",
                  color: "#dc2626",
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                Error: {error}
              </div>
            )}
            {!loading && !error && parkings.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "#94a3b8",
                }}
              >
                <MapPin size={38} style={{ marginBottom: 12 }} />
                <p style={{ fontWeight: 600, marginBottom: 4 }}>
                  Sin registros aún
                </p>
                <p style={{ fontSize: 13 }}>
                  Agrega el primer registro con el botón de arriba
                </p>
              </div>
            )}

            {!loading && !error && parkings.length > 0 && (
              <>
                <button
                  style={
                    filterKey === "all" ? unitBtnActive("#2563eb") : unitBtn
                  }
                  onClick={handleAllGroups}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#2563eb",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, textAlign: "left" }}>
                    {ALL_LABEL[groupBy]}
                  </span>
                  <span style={badge}>{parkings.length}</span>
                </button>

                {/* ── FLAT modes: unit / date / address ── */}
                {groupBy !== "date_unit" &&
                  groups.map((g) => {
                    const isExpanded = expandedGroups.has(g.key);
                    const isActive = filterKey === g.key;
                    const items = applyDateFilter(g.items);
                    return (
                      <div
                        key={g.key}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 4,
                            alignItems: "stretch",
                          }}
                        >
                          <button
                            style={{
                              ...(isActive ? unitBtnActive(g.color) : unitBtn),
                              flex: 1,
                            }}
                            onClick={() => toggleGroup(g.key)}
                          >
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: g.color,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                flex: 1,
                                textAlign: "left",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {g.label}
                            </span>
                            <span style={badge}>{g.count}</span>
                            <ChevronDown
                              size={14}
                              style={{
                                flexShrink: 0,
                                transform: isExpanded
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                                transition: "transform 0.2s",
                                color: isActive ? g.color : "#94a3b8",
                                marginLeft: 4,
                              }}
                            />
                          </button>
                          {groupBy === "unit" && (
                            <button
                              onClick={(e) => handleDeleteGroup(e, g)}
                              style={{
                                padding: "0 10px",
                                background: "#fef2f2",
                                border: "1px solid #fee2e2",
                                borderRadius: 8,
                                cursor: "pointer",
                                color: "#dc2626",
                                display: "flex",
                                alignItems: "center",
                                flexShrink: 0,
                              }}
                              title={`Eliminar registros de ${g.label}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        {isExpanded && (
                          <div
                            style={{
                              paddingLeft: 14,
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            {items.length === 0 ? (
                              <p
                                style={{
                                  fontSize: 11,
                                  color: "#94a3b8",
                                  padding: "6px 10px",
                                }}
                              >
                                Sin registros en el rango
                              </p>
                            ) : (
                              items.map((p, idx) =>
                                renderItem(
                                  p,
                                  idx,
                                  unitColors[p.unit_id] || "#64748b",
                                  groupBy !== "unit",
                                  groupBy !== "date",
                                  groupBy !== "address",
                                ),
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* ── TWO-LEVEL mode: date_unit ── */}
                {groupBy === "date_unit" &&
                  groups.map((dg) => {
                    const dateExpanded = expandedGroups.has(dg.key);
                    const dateActive =
                      filterKey === dg.key ||
                      filterKey.startsWith(dg.key + "||");
                    const filteredSubgroups = dg.subgroups.filter((sg) =>
                      !filterDateFrom && !filterDateTo
                        ? true
                        : dg.key >= (filterDateFrom || "") &&
                          dg.key <= (filterDateTo || "zzzz"),
                    );
                    return (
                      <div
                        key={dg.key}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        {/* Date header */}
                        <button
                          style={{
                            ...(dateActive ? unitBtnActive(dg.color) : unitBtn),
                          }}
                          onClick={() => toggleDateGroup(dg.key)}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: dg.color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              flex: 1,
                              textAlign: "left",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {dg.label}
                          </span>
                          <span style={badge}>{dg.count}</span>
                          <ChevronDown
                            size={14}
                            style={{
                              flexShrink: 0,
                              transform: dateExpanded
                                ? "rotate(180deg)"
                                : "rotate(0deg)",
                              transition: "transform 0.2s",
                              color: dateActive ? dg.color : "#94a3b8",
                              marginLeft: 4,
                            }}
                          />
                        </button>

                        {/* Unit subgroups */}
                        {dateExpanded && (
                          <div
                            style={{
                              paddingLeft: 12,
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            {filteredSubgroups.map((sg) => {
                              const sgExpanded = expandedSubgroups.has(sg.key);
                              const sgActive = filterKey === sg.key;
                              return (
                                <div
                                  key={sg.key}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 3,
                                  }}
                                >
                                  {/* Unit subgroup header */}
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 4,
                                      alignItems: "stretch",
                                    }}
                                  >
                                    <button
                                      style={{
                                        ...(sgActive
                                          ? unitBtnActive(sg.color)
                                          : unitBtn),
                                        flex: 1,
                                        fontSize: 12,
                                      }}
                                      onClick={() =>
                                        toggleUnitSubgroup(sg.key, dg.key)
                                      }
                                    >
                                      <span
                                        style={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: "50%",
                                          background: sg.color,
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span
                                        style={{
                                          flex: 1,
                                          textAlign: "left",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {sg.label}
                                      </span>
                                      <span style={badge}>{sg.count}</span>
                                      <ChevronDown
                                        size={12}
                                        style={{
                                          flexShrink: 0,
                                          transform: sgExpanded
                                            ? "rotate(180deg)"
                                            : "rotate(0deg)",
                                          transition: "transform 0.2s",
                                          color: sgActive
                                            ? sg.color
                                            : "#94a3b8",
                                          marginLeft: 4,
                                        }}
                                      />
                                    </button>
                                  </div>
                                  {/* Items inside unit subgroup */}
                                  {sgExpanded && (
                                    <div
                                      style={{
                                        paddingLeft: 12,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 3,
                                      }}
                                    >
                                      {sg.items.map((p, idx) =>
                                        renderItem(
                                          p,
                                          idx,
                                          sg.color,
                                          false,
                                          true,
                                          true,
                                        ),
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </>
            )}
          </div>
        </aside>

        <main style={{ flex: 1, position: "relative" }}>
          {!loading && (
            <MapView
              parkings={visibleParkings}
              unitColors={unitColors}
              highlightId={highlightId}
              onMarkerClick={handleSelect}
            />
          )}
          {loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#94a3b8",
              }}
            >
              Cargando mapa...
            </div>
          )}
        </main>
      </div>

      {showForm && (
        <ParkingForm
          onCreated={handleCreated}
          onClose={() => setShowForm(false)}
        />
      )}
      {showShare && (
        <ShareLinkModal
          units={buildGroups(parkings, "unit", unitColors).map((g) => ({
            id: g.unitId,
            name: g.label,
            count: g.count,
          }))}
          dateFrom={filterDateFrom}
          dateTo={filterDateTo}
          groupBy={groupBy}
          onClose={() => setShowShare(false)}
        />
      )}
      {showImport && (
        <ImportModal
          onImported={handleImported}
          onClose={() => setShowImport(false)}
        />
      )}
      {showSharesList && (
        <SharesListModal onClose={() => setShowSharesList(false)} />
      )}
      {dialog}

      {tooltipParking && (
        <div
          style={{
            position: "fixed",
            left: 368,
            top: tooltipPos,
            width: 262,
            zIndex: 3000,
            pointerEvents: "none",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
            border: "1px solid rgba(0,0,0,0.07)",
          }}
        >
          <div
            style={{
              background: tooltipParking._color,
              color: "white",
              padding: "10px 14px",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {tooltipParking.unit_name || tooltipParking.unit_id}
          </div>
          <div
            style={{
              background: "white",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <TooltipRow label="ID Unidad" value={tooltipParking.unit_id} />
            <TooltipRow
              label="Tiempo estacionado"
              value={fmtDur(tooltipParking.parking_duration)}
            />
            <TooltipRow
              label="Inicio"
              value={fmtDt(tooltipParking.parking_start)}
            />
            <TooltipRow
              label="Coordenadas"
              value={`${tooltipParking.latitude.toFixed(6)}, ${tooltipParking.longitude.toFixed(6)}`}
            />
            {tooltipParking.address && (
              <TooltipRow label="Dirección" value={tooltipParking.address} />
            )}
            {tooltipParking.notes && (
              <TooltipRow label="Notas" value={tooltipParking.notes} />
            )}
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              Registrado: {fmtDt(tooltipParking.created_at)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TooltipRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 12,
      }}
    >
      <span style={{ color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span
        style={{ fontWeight: 500, textAlign: "right", wordBreak: "break-all" }}
      >
        {value}
      </span>
    </div>
  );
}

function fmtDur(minutes) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function fmtDt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateKey(p) {
  const d = p.parking_start || p.created_at;
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

const headerStyle = {
  background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
  padding: "12px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 2px 12px rgba(37,99,235,0.4)",
  zIndex: 10,
  flexShrink: 0,
};
const sidebar = {
  width: 360,
  background: "white",
  borderRight: "1px solid #e2e8f0",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  flexShrink: 0,
};
const btnWhite = {
  padding: "8px 16px",
  background: "white",
  color: "#1d4ed8",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
const btnOutline = {
  padding: "8px 16px",
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.4)",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const unitBtn = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "inherit",
  width: "100%",
  color: "#374151",
};
const unitBtnActive = (color) => ({
  ...unitBtn,
  background: color + "18",
  border: `1px solid ${color}`,
  color,
  fontWeight: 700,
});
const badge = {
  background: "#e2e8f0",
  color: "#475569",
  fontSize: 11,
  fontWeight: 700,
  padding: "1px 7px",
  borderRadius: 20,
  flexShrink: 0,
};
const dateInputStyle = {
  flex: 1,
  minWidth: 0,
  padding: "4px 7px",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  fontSize: 12,
  color: "#374151",
  outline: "none",
  fontFamily: "inherit",
  cursor: "pointer",
};
const groupPill = {
  flex: 1,
  padding: "5px 4px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 11,
  fontFamily: "inherit",
  color: "#475569",
  fontWeight: 500,
  whiteSpace: "nowrap",
};
const groupPillActive = {
  ...groupPill,
  background: "#eff6ff",
  border: "1px solid #2563eb",
  color: "#2563eb",
  fontWeight: 700,
};
