import { useEffect, useMemo, useState } from "react";
import {
  createMenuItem,
  deleteMenuItem,
  formatCurrency,
  listMenuItems,
  setMenuItemAvailability,
  updateMenuItem,
} from "./orderService";

const EMPTY_FORM = {
  name: "",
  category: "Chef Signatures",
  description: "",
  price: "",
  imageUrl: "",
  arModelUrl: "",
  displayOrder: "0",
  isAvailable: true,
};

function MenuItemForm({ initial, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="menu-mgr-form">
      <div className="menu-mgr-form-grid">
        <label className="admin-field">
          <span>Name</span>
          <input onChange={(e) => update("name", e.target.value)} value={form.name} />
        </label>
        <label className="admin-field">
          <span>Category</span>
          <input onChange={(e) => update("category", e.target.value)} value={form.category} />
        </label>
        <label className="admin-field">
          <span>Price (PKR)</span>
          <input
            inputMode="numeric"
            onChange={(e) => update("price", e.target.value.replace(/[^\d.]/g, ""))}
            value={form.price}
          />
        </label>
        <label className="admin-field">
          <span>Display order</span>
          <input
            inputMode="numeric"
            onChange={(e) => update("displayOrder", e.target.value.replace(/[^\d]/g, ""))}
            value={form.displayOrder}
          />
        </label>
        <label className="admin-field menu-mgr-wide">
          <span>Description</span>
          <textarea
            onChange={(e) => update("description", e.target.value)}
            rows={2}
            value={form.description}
          />
        </label>
        <label className="admin-field">
          <span>Image URL</span>
          <input onChange={(e) => update("imageUrl", e.target.value)} value={form.imageUrl} />
        </label>
        <label className="admin-field">
          <span>AR model URL (.glb)</span>
          <input onChange={(e) => update("arModelUrl", e.target.value)} value={form.arModelUrl} />
        </label>
        <label className="admin-checkbox">
          <input
            checked={form.isAvailable}
            onChange={(e) => update("isAvailable", e.target.checked)}
            type="checkbox"
          />
          <span>Available</span>
        </label>
      </div>

      <div className="menu-mgr-form-actions">
        <button
          className="admin-primary-button"
          disabled={submitting || !form.name.trim() || !form.price}
          onClick={() => onSubmit(form)}
        >
          {submitting ? "Saving..." : "Save dish"}
        </button>
        {onCancel ? (
          <button className="admin-secondary-button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function MenuManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listMenuItems();
      setItems(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    });
    return Array.from(map.entries());
  }, [items]);

  function toPayload(form) {
    return {
      name: form.name.trim(),
      category: form.category.trim() || "Menu",
      description: form.description,
      price: Number(form.price || 0),
      imageUrl: form.imageUrl.trim(),
      arModelUrl: form.arModelUrl.trim(),
      displayOrder: Number(form.displayOrder || 0),
      isAvailable: form.isAvailable !== false,
    };
  }

  async function handleCreate(form) {
    setSubmitting(true);
    setError("");
    try {
      await createMenuItem({ item: toPayload(form) });
      setAdding(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id, form) {
    setSubmitting(true);
    setError("");
    try {
      await updateMenuItem({ id, item: toPayload(form) });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(item) {
    setError("");
    try {
      await setMenuItemAvailability({ id: item.id, available: !item.isAvailable });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) {
      return;
    }
    setError("");
    try {
      await deleteMenuItem({ id: item.id });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <p className="admin-section-label">Menu management</p>
          <h2>Dishes &amp; availability</h2>
        </div>
        {!adding ? (
          <button className="admin-primary-button" onClick={() => setAdding(true)}>
            Add dish
          </button>
        ) : null}
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      {adding ? (
        <MenuItemForm
          initial={EMPTY_FORM}
          onCancel={() => setAdding(false)}
          onSubmit={handleCreate}
          submitting={submitting}
        />
      ) : null}

      {loading ? (
        <p>Loading menu...</p>
      ) : (
        grouped.map(([category, list]) => (
          <div className="menu-mgr-group" key={category}>
            <h3 className="menu-mgr-category">{category}</h3>
            {list.map((item) =>
              editingId === item.id ? (
                <MenuItemForm
                  initial={{
                    name: item.name,
                    category: item.category,
                    description: item.description,
                    price: String(item.price),
                    imageUrl: item.imageUrl || "",
                    arModelUrl: item.arModelUrl || "",
                    displayOrder: String(item.displayOrder),
                    isAvailable: item.isAvailable,
                  }}
                  key={item.id}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(form) => handleUpdate(item.id, form)}
                  submitting={submitting}
                />
              ) : (
                <div className="menu-mgr-row" key={item.id}>
                  <div className="menu-mgr-row-main">
                    <strong>{item.name}</strong>
                    <span className={`menu-mgr-tag ${item.isAvailable ? "is-on" : "is-off"}`}>
                      {item.isAvailable ? "Available" : "Hidden"}
                    </span>
                    <p>{item.description}</p>
                  </div>
                  <div className="menu-mgr-row-side">
                    <strong>{formatCurrency(item.price)}</strong>
                    <div className="menu-mgr-row-actions">
                      <button onClick={() => handleToggle(item)}>
                        {item.isAvailable ? "Hide" : "Show"}
                      </button>
                      <button onClick={() => setEditingId(item.id)}>Edit</button>
                      <button className="menu-mgr-delete" onClick={() => handleDelete(item)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        ))
      )}
    </section>
  );
}
