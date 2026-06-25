import { useEffect, useState } from "react";
import {
  clockInStaff,
  clockOutStaff,
  createStaffMember,
  deleteStaffMember,
  listStaff,
  updateStaffMember,
} from "./orderService";

const EMPTY_MEMBER = {
  name: "",
  role: "server",
  phone: "",
  hourlyRate: "",
  isActive: true,
};

export default function StaffOps() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(EMPTY_MEMBER);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setStaff(await listStaff());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(member) {
    setEditingId(member.id);
    setForm({
      name: member.name,
      role: member.role,
      phone: member.phone || "",
      hourlyRate: member.hourlyRate || "",
      isActive: member.isActive,
    });
    setShowForm(true);
  }

  async function saveMember(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Staff name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
      };
      if (editingId) {
        await updateStaffMember({ id: editingId, member: payload });
      } else {
        await createStaffMember({ member: payload });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_MEMBER);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleClock(member) {
    setError("");
    try {
      if (member.activeShiftId) {
        await clockOutStaff({ shiftId: member.activeShiftId, staffId: member.id });
      } else {
        await clockInStaff({ staffId: member.id });
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(member) {
    if (!window.confirm(`Delete ${member.name}?`)) return;
    try {
      await deleteStaffMember({ id: member.id });
      setStaff((current) => current.filter((item) => item.id !== member.id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="admin-panel staff-wrap">
      <div className="admin-panel-head">
        <div>
          <p className="admin-section-label">Staff operations</p>
          <h2>Roles, shifts, and service coverage</h2>
        </div>
        <button
          className="admin-primary-button"
          onClick={() => {
            setShowForm((value) => !value);
            setEditingId(null);
            setForm(EMPTY_MEMBER);
          }}
        >
          {showForm ? "Close" : "+ Add staff"}
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      {showForm ? (
        <form className="menu-mgr-form" onSubmit={saveMember}>
          <div className="menu-mgr-form-grid">
            <label className="admin-field">
              <span>Name</span>
              <input value={form.name} onChange={(event) => update("name", event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Role</span>
              <select value={form.role} onChange={(event) => update("role", event.target.value)}>
                <option value="manager">Manager</option>
                <option value="server">Server</option>
                <option value="head_chef">Head chef</option>
                <option value="kitchen_staff">Kitchen staff</option>
                <option value="cashier">Cashier</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Phone</span>
              <input value={form.phone} onChange={(event) => update("phone", event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Hourly rate</span>
              <input
                min="0"
                type="number"
                value={form.hourlyRate}
                onChange={(event) => update("hourlyRate", event.target.value)}
              />
            </label>
          </div>
          <div className="menu-mgr-form-actions">
            <button className="admin-primary-button" disabled={saving} type="submit">
              {saving ? "Saving..." : editingId ? "Update staff" : "Create staff"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="admin-empty">Loading staff...</p>
      ) : (
        <div className="staff-grid">
          {staff.map((member) => (
            <article className="staff-card" key={member.id}>
              <div>
                <span className={`shift-dot${member.activeShiftId ? " is-on" : ""}`} />
                <h3>{member.name}</h3>
                <p>{member.role.replaceAll("_", " ")}</p>
              </div>
              <div className="staff-card-meta">
                <span>{member.phone || "No phone"}</span>
                <span>{member.hourlyRate ? `PKR ${member.hourlyRate}/hr` : "Rate unset"}</span>
                <span>{member.activeShiftId ? "Clocked in" : "Off shift"}</span>
              </div>
              <div className="menu-mgr-row-actions">
                <button onClick={() => toggleClock(member)}>
                  {member.activeShiftId ? "Clock out" : "Clock in"}
                </button>
                <button onClick={() => startEdit(member)}>Edit</button>
                <button className="menu-mgr-delete" onClick={() => remove(member)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
