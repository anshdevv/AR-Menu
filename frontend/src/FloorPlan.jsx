import { useEffect, useState } from "react";
import { listTables, updateTableStatus, getAdminOrders } from "./orderService";

const STATUS_META = {
  available:  { label: "Available",  color: "#2f8f6b", bg: "#e3f6ee" },
  occupied:   { label: "Occupied",   color: "#b5503f", bg: "#fbe7e3" },
  reserved:   { label: "Reserved",   color: "#9b7414", bg: "#fdf3dd" },
  cleaning:   { label: "Cleaning",   color: "#6b7280", bg: "#f3f4f6" },
};

const TRANSITIONS = {
  available: ["occupied", "reserved", "cleaning"],
  occupied:  ["available", "cleaning"],
  reserved:  ["occupied", "available", "cleaning"],
  cleaning:  ["available"],
};

export default function FloorPlan({ onChanged }) {
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [tbls, ords] = await Promise.all([listTables(), getAdminOrders()]);
        if (active) { setTables(tbls); setOrders(ords); }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
  }, []);

  function activeOrdersForTable(tableNumber) {
    return orders.filter(o => o.tableNumber === tableNumber && !["served","cancelled","expired"].includes(o.status));
  }

  async function handleStatusChange(table, newStatus) {
    setChanging(true);
    try {
      await updateTableStatus({ tableId: table.id, status: newStatus });
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: newStatus } : t));
      setSelected(null);
      if (onChanged) onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setChanging(false);
    }
  }

  if (loading) return <div className="floor-loading">Loading floor plan…</div>;

  return (
    <div className="floor-wrap">
      {error && <p className="admin-error">{error}</p>}

      <div className="floor-legend">
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <span key={key} className="floor-legend-item" style={{ background: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
        ))}
      </div>

      <div className="floor-grid">
        {tables.filter(t => t.isActive).map(table => {
          const meta = STATUS_META[table.status] || STATUS_META.available;
          const activeOrders = activeOrdersForTable(table.tableNumber);
          return (
            <button
              key={table.id}
              className={`floor-table${selected?.id === table.id ? " is-selected" : ""}`}
              style={{ background: meta.bg, borderColor: meta.color }}
              onClick={() => setSelected(selected?.id === table.id ? null : table)}
            >
              <span className="floor-table-num">{table.tableNumber}</span>
              <span className="floor-table-status" style={{ color: meta.color }}>{meta.label}</span>
              {table.seats && <span className="floor-table-seats">{table.seats} seats</span>}
              {activeOrders.length > 0 && (
                <span className="floor-order-badge">{activeOrders.length} order{activeOrders.length > 1 ? "s" : ""}</span>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="floor-popup">
          <div className="floor-popup-head">
            <strong>{selected.tableNumber}</strong>
            <span style={{ color: STATUS_META[selected.status]?.color }}>{STATUS_META[selected.status]?.label}</span>
            <button className="floor-popup-close" onClick={() => setSelected(null)}>✕</button>
          </div>
          <p className="floor-popup-meta">{selected.label || ""}{selected.seats ? ` · ${selected.seats} seats` : ""}</p>

          {activeOrdersForTable(selected.tableNumber).length > 0 && (
            <div className="floor-popup-orders">
              <p className="floor-popup-subtitle">Active orders</p>
              {activeOrdersForTable(selected.tableNumber).map(o => (
                <div key={o.id} className="floor-popup-order">
                  <span>#{o.id} {o.customerName || "Guest"}</span>
                  <span className={`admin-order-status status-${o.status}`}>{o.status}</span>
                </div>
              ))}
            </div>
          )}

          <p className="floor-popup-subtitle">Change status</p>
          <div className="floor-popup-actions">
            {(TRANSITIONS[selected.status] || []).map(s => (
              <button
                key={s}
                className="floor-action-btn"
                style={{ background: STATUS_META[s]?.bg, color: STATUS_META[s]?.color, borderColor: STATUS_META[s]?.color }}
                disabled={changing}
                onClick={() => handleStatusChange(selected, s)}
              >
                Mark {STATUS_META[s]?.label || s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
