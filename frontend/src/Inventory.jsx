import { useEffect, useState } from "react";
import {
  adjustInventoryStock, createInventoryItem,
  deleteInventoryItem, formatCurrency,
  listInventory, updateInventoryItem,
} from "./orderService";

const EMPTY_FORM = {
  name: "", category: "General", unit: "pcs",
  quantityOnHand: "0", lowStockThreshold: "10",
  costPerUnit: "0", supplier: "",
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [restockId, setRestockId] = useState(null);
  const [restockDelta, setRestockDelta] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setItems(await listInventory());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function startEdit(item) {
    setEditId(item.id);
    setForm({
      name: item.name, category: item.category, unit: item.unit,
      quantityOnHand: String(item.quantityOnHand), lowStockThreshold: String(item.lowStockThreshold),
      costPerUnit: String(item.costPerUnit), supplier: item.supplier || "",
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name, category: form.category, unit: form.unit,
        quantityOnHand: Number(form.quantityOnHand),
        lowStockThreshold: Number(form.lowStockThreshold),
        costPerUnit: Number(form.costPerUnit),
        supplier: form.supplier || null,
      };
      if (editId) {
        await updateInventoryItem({ id: editId, item: payload });
      } else {
        await createInventoryItem({ item: payload });
      }
      setShowForm(false);
      setEditId(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this inventory item?")) return;
    try {
      await deleteInventoryItem({ id });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRestock(id) {
    const delta = Number(restockDelta);
    if (!delta) { setError("Enter a quantity."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await adjustInventoryStock({ id, delta });
      setItems(prev => prev.map(i => i.id === id
        ? { ...i, quantityOnHand: res.quantityOnHand, isLow: res.quantityOnHand <= i.lowStockThreshold, lastRestockedAt: delta > 0 ? new Date().toISOString() : i.lastRestockedAt }
        : i));
      setRestockId(null);
      setRestockDelta("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const grouped = items.reduce((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  const lowCount = items.filter(i => i.isLow).length;

  return (
    <div className="inv-wrap admin-panel">
      <div className="admin-panel-head">
        <div>
          <p className="admin-section-label">Inventory</p>
          <h2>Stock management{lowCount > 0 && <span className="inv-low-badge">{lowCount} low</span>}</h2>
        </div>
        <button className="admin-primary-button" onClick={startCreate}>+ Add item</button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      {showForm && (
        <form className="menu-mgr-form" onSubmit={handleSave}>
          <div className="menu-mgr-form-grid">
            <label className="admin-field">
              <span>Name *</span>
              <input value={form.name} onChange={e => setField("name", e.target.value)} placeholder="e.g. Chicken Breast" />
            </label>
            <label className="admin-field">
              <span>Category</span>
              <input value={form.category} onChange={e => setField("category", e.target.value)} placeholder="e.g. Proteins" />
            </label>
            <label className="admin-field">
              <span>Unit</span>
              <input value={form.unit} onChange={e => setField("unit", e.target.value)} placeholder="kg, L, pcs…" />
            </label>
            <label className="admin-field">
              <span>Qty on hand</span>
              <input type="number" min="0" step="0.01" value={form.quantityOnHand} onChange={e => setField("quantityOnHand", e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Low-stock threshold</span>
              <input type="number" min="0" step="0.01" value={form.lowStockThreshold} onChange={e => setField("lowStockThreshold", e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Cost per unit (PKR)</span>
              <input type="number" min="0" step="1" value={form.costPerUnit} onChange={e => setField("costPerUnit", e.target.value)} />
            </label>
            <label className="admin-field menu-mgr-wide">
              <span>Supplier</span>
              <input value={form.supplier} onChange={e => setField("supplier", e.target.value)} placeholder="Supplier name" />
            </label>
          </div>
          <div className="menu-mgr-form-actions">
            <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : editId ? "Update item" : "Add item"}</button>
            <button type="button" className="admin-secondary-button" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="admin-empty">Loading inventory…</p>
      ) : (
        Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} className="inv-group">
            <h3 className="inv-category">{cat}</h3>
            {catItems.map(item => (
              <div key={item.id} className={`inv-row${item.isLow ? " is-low" : ""}`}>
                <div className="inv-row-main">
                  <strong>{item.name}</strong>
                  {item.isLow && <span className="inv-alert">Low stock</span>}
                  <div className="inv-row-meta">
                    <span>{item.quantityOnHand} {item.unit}</span>
                    {item.supplier && <span>· {item.supplier}</span>}
                    <span>· {formatCurrency(item.costPerUnit)}/{item.unit}</span>
                  </div>
                  <div className="inv-stock-bar">
                    <div
                      className="inv-stock-fill"
                      style={{
                        width: `${Math.min(100, item.lowStockThreshold > 0 ? (item.quantityOnHand / (item.lowStockThreshold * 3)) * 100 : 100)}%`,
                        background: item.isLow ? "#c0392b" : "#16a34a",
                      }}
                    />
                  </div>
                </div>

                {restockId === item.id ? (
                  <div className="inv-restock-form">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Qty"
                      value={restockDelta}
                      onChange={e => setRestockDelta(e.target.value)}
                      style={{ width: 80 }}
                    />
                    <button className="admin-primary-button" disabled={saving} onClick={() => handleRestock(item.id)}>
                      {saving ? "…" : "Apply"}
                    </button>
                    <button className="admin-secondary-button" onClick={() => { setRestockId(null); setRestockDelta(""); }}>Cancel</button>
                  </div>
                ) : (
                  <div className="menu-mgr-row-actions">
                    <button onClick={() => { setRestockId(item.id); setRestockDelta(""); }}>Restock</button>
                    <button onClick={() => startEdit(item)}>Edit</button>
                    <button className="menu-mgr-delete" onClick={() => handleDelete(item.id)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
