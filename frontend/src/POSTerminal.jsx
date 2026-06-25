import { useEffect, useState } from "react";
import { createPosOrder, formatCurrency, listMenuItems, listTables } from "./orderService";
import { printKitchenTicket } from "./printing";

const EMPTY_FORM = { customerName: "", tableId: "", specialRequest: "" };

export default function POSTerminal({ restaurant, onOrderPlaced }) {
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lastOrder, setLastOrder] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [items, tbls] = await Promise.all([listMenuItems(), listTables()]);
        if (active) { setMenuItems(items); setTables(tbls); }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const categories = ["All", ...Array.from(new Set(menuItems.map(i => i.category)))];
  const filtered = menuItems.filter(i => {
    if (!i.isAvailable) return false;
    if (categoryFilter !== "All" && i.category !== categoryFilter) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function addToCart(item) {
    setCart(prev => {
      const idx = prev.findIndex(c => c.menuItemId === item.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function setQty(menuItemId, qty) {
    if (qty <= 0) setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));
    else setCart(prev => prev.map(c => c.menuItemId === menuItemId ? { ...c, quantity: qty } : c));
  }

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const selectedTable = form.tableId ? tables.find(t => String(t.id) === String(form.tableId)) : null;

  async function handleCharge() {
    if (!cart.length) { setError("Add at least one item."); return; }
    setSubmitting(true);
    setError("");
    try {
      const result = await createPosOrder({
        order: {
          tableId: form.tableId ? Number(form.tableId) : null,
          tableNumber: selectedTable?.tableNumber || "",
          customerName: form.customerName,
          specialRequest: form.specialRequest,
          items: cart.map(c => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
        },
      });
      setLastOrder({ ...result, items: cart, total, customerName: form.customerName, tableNumber: selectedTable?.tableNumber || "Walk-in" });
      setCart([]);
      setForm(EMPTY_FORM);
      if (onOrderPlaced) onOrderPlaced();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="pos-loading">Loading menu...</div>;

  return (
    <div className="pos-wrap">
      {lastOrder && (
        <div className="pos-success-banner">
          <span>Order #{lastOrder.orderId} sent to kitchen — {formatCurrency(lastOrder.total)} for {lastOrder.tableNumber}</span>
          <button onClick={() => printKitchenTicket({ restaurant, order: { ...lastOrder, tableNumber: lastOrder.tableNumber, items: lastOrder.items } })}>Print ticket</button>
          <button className="pos-dismiss" onClick={() => setLastOrder(null)}>✕</button>
        </div>
      )}

      <div className="pos-layout">
        {/* Menu panel */}
        <div className="pos-menu">
          <div className="pos-menu-controls">
            <input
              className="pos-search"
              placeholder="Search menu…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="pos-cats">
              {categories.map(c => (
                <button
                  key={c}
                  className={`pos-cat${categoryFilter === c ? " is-active" : ""}`}
                  onClick={() => setCategoryFilter(c)}
                >{c}</button>
              ))}
            </div>
          </div>

          <div className="pos-items">
            {filtered.map(item => {
              const inCart = cart.find(c => c.menuItemId === item.id);
              return (
                <button key={item.id} className={`pos-item${inCart ? " in-cart" : ""}`} onClick={() => addToCart(item)}>
                  <span className="pos-item-name">{item.name}</span>
                  <span className="pos-item-cat">{item.category}</span>
                  <span className="pos-item-price">{formatCurrency(item.price)}</span>
                  {inCart && <span className="pos-item-badge">{inCart.quantity}</span>}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="pos-empty">No items match your search.</p>}
          </div>
        </div>

        {/* Order panel */}
        <div className="pos-order">
          <div className="pos-order-head">
            <p className="pos-order-label">New order</p>
            <div className="pos-order-fields">
              <input
                className="pos-field"
                placeholder="Customer name"
                value={form.customerName}
                onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              />
              <select
                className="pos-field"
                value={form.tableId}
                onChange={e => setForm(f => ({ ...f, tableId: e.target.value }))}
              >
                <option value="">Walk-in / no table</option>
                {tables.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.tableNumber} — {t.label || t.seats + " seats"}</option>
                ))}
              </select>
              <input
                className="pos-field"
                placeholder="Special request"
                value={form.specialRequest}
                onChange={e => setForm(f => ({ ...f, specialRequest: e.target.value }))}
              />
            </div>
          </div>

          <div className="pos-cart">
            {cart.length === 0 && <p className="pos-cart-empty">Tap items from the menu to add them.</p>}
            {cart.map(c => (
              <div key={c.menuItemId} className="pos-cart-row">
                <div className="pos-cart-info">
                  <span className="pos-cart-name">{c.name}</span>
                  <span className="pos-cart-line">{formatCurrency(c.price * c.quantity)}</span>
                </div>
                <div className="pos-cart-qty">
                  <button onClick={() => setQty(c.menuItemId, c.quantity - 1)}>−</button>
                  <span>{c.quantity}</span>
                  <button onClick={() => setQty(c.menuItemId, c.quantity + 1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="pos-order-foot">
            {error && <p className="admin-error">{error}</p>}
            <div className="pos-total-row">
              <span>Total</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            <button className="pos-charge-btn" disabled={submitting || !cart.length} onClick={handleCharge}>
              {submitting ? "Sending to kitchen…" : `Charge ${formatCurrency(total)}`}
            </button>
            {cart.length > 0 && (
              <button className="pos-clear-btn" onClick={() => setCart([])}>Clear order</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
