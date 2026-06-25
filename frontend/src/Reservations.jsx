import { useEffect, useState } from "react";
import {
  createReservation, deleteReservation, listReservations,
  listTables, updateReservationStatus,
} from "./orderService";

const STATUS_META = {
  confirmed: { label: "Confirmed", cls: "res-confirmed" },
  seated:    { label: "Seated",    cls: "res-seated" },
  completed: { label: "Completed", cls: "res-completed" },
  cancelled: { label: "Cancelled", cls: "res-cancelled" },
  no_show:   { label: "No-show",   cls: "res-cancelled" },
};

const EMPTY_FORM = {
  guestName: "", guestPhone: "", partySize: "2",
  reservedAt: "", durationMinutes: "90", tableId: "", notes: "", status: "confirmed",
};

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export default function Reservations() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadReservations(forDate = date) {
    setLoading(true);
    try {
      const [res, tbls] = await Promise.all([
        listReservations({ from: forDate, to: forDate }),
        listTables(),
      ]);
      setReservations(res);
      setTables(tbls);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReservations(); }, []);

  function handleDateChange(newDate) {
    setDate(newDate);
    loadReservations(newDate);
  }

  async function handleStatusChange(id, status) {
    try {
      await updateReservationStatus({ id, status });
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteReservation({ id });
      setReservations(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.guestName.trim() || !form.reservedAt) { setError("Guest name and time required."); return; }
    setSaving(true);
    setError("");
    try {
      await createReservation({
        reservation: {
          guestName: form.guestName,
          guestPhone: form.guestPhone || null,
          partySize: Number(form.partySize || 2),
          reservedAt: `${date}T${form.reservedAt}:00`,
          durationMinutes: Number(form.durationMinutes || 90),
          tableId: form.tableId || null,
          notes: form.notes,
          status: form.status,
        },
      });
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      await loadReservations();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function setField(key, value) { setForm(f => ({ ...f, [key]: value })); }

  return (
    <div className="res-wrap admin-panel">
      <div className="admin-panel-head">
        <div>
          <p className="admin-section-label">Reservations</p>
          <h2>Table bookings</h2>
        </div>
        <button className="admin-primary-button" onClick={() => setShowForm(v => !v)}>
          {showForm ? "Cancel" : "+ New reservation"}
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      {showForm && (
        <form className="res-form menu-mgr-form" onSubmit={handleCreate}>
          <div className="menu-mgr-form-grid">
            <label className="admin-field">
              <span>Guest name *</span>
              <input value={form.guestName} onChange={e => setField("guestName", e.target.value)} placeholder="e.g. Raza Family" />
            </label>
            <label className="admin-field">
              <span>Phone</span>
              <input value={form.guestPhone} onChange={e => setField("guestPhone", e.target.value)} placeholder="+92-300-..." />
            </label>
            <label className="admin-field">
              <span>Party size</span>
              <input type="number" min="1" max="30" value={form.partySize} onChange={e => setField("partySize", e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Time *</span>
              <input type="time" value={form.reservedAt} onChange={e => setField("reservedAt", e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Duration (min)</span>
              <input type="number" min="30" step="15" value={form.durationMinutes} onChange={e => setField("durationMinutes", e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Table</span>
              <select value={form.tableId} onChange={e => setField("tableId", e.target.value)}>
                <option value="">Not assigned</option>
                {tables.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.tableNumber}</option>
                ))}
              </select>
            </label>
            <label className="admin-field menu-mgr-wide">
              <span>Notes</span>
              <input value={form.notes} onChange={e => setField("notes", e.target.value)} placeholder="Birthday, allergens, seating preference…" />
            </label>
          </div>
          <div className="menu-mgr-form-actions">
            <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Create reservation"}</button>
          </div>
        </form>
      )}

      <div className="res-date-bar">
        <button onClick={() => { const d = new Date(date); d.setDate(d.getDate()-1); handleDateChange(d.toISOString().slice(0,10)); }}>‹</button>
        <input type="date" value={date} onChange={e => handleDateChange(e.target.value)} />
        <button onClick={() => { const d = new Date(date); d.setDate(d.getDate()+1); handleDateChange(d.toISOString().slice(0,10)); }}>›</button>
        <span className="res-date-label">{fmtDate(date + "T12:00:00")}</span>
      </div>

      {loading ? (
        <p className="admin-empty">Loading…</p>
      ) : reservations.length === 0 ? (
        <p className="admin-empty">No reservations for this day.</p>
      ) : (
        <div className="res-list">
          {reservations.map(r => (
            <div key={r.id} className={`res-card${r.status === "cancelled" || r.status === "no_show" ? " is-dim" : ""}`}>
              <div className="res-card-left">
                <div className="res-time">{fmtTime(r.reservedAt)}</div>
                <div className="res-duration">{r.durationMinutes}min</div>
              </div>
              <div className="res-card-body">
                <strong className="res-guest">{r.guestName}</strong>
                <div className="res-meta">
                  <span>{r.partySize} guests</span>
                  {r.tableNumber && <span>· {r.tableNumber}</span>}
                  {r.guestPhone && <span>· {r.guestPhone}</span>}
                </div>
                {r.notes && <p className="res-notes">{r.notes}</p>}
              </div>
              <div className="res-card-right">
                <span className={`res-status-chip ${STATUS_META[r.status]?.cls || ""}`}>{STATUS_META[r.status]?.label || r.status}</span>
                <div className="res-actions">
                  {r.status === "confirmed" && (
                    <button onClick={() => handleStatusChange(r.id, "seated")}>Seat</button>
                  )}
                  {r.status === "seated" && (
                    <button onClick={() => handleStatusChange(r.id, "completed")}>Complete</button>
                  )}
                  {["confirmed","seated"].includes(r.status) && (
                    <button onClick={() => handleStatusChange(r.id, "cancelled")}>Cancel</button>
                  )}
                  <button className="res-delete" onClick={() => handleDelete(r.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
