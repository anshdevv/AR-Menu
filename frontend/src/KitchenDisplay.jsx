import { useMemo, useState } from "react";
import {
  ORDER_STATUS_META,
  advanceOrderStatus,
  cancelOrder,
  formatCurrency,
  nextStatus,
} from "./orderService";
import { printKitchenTicket } from "./printing";

function formatTimestamp(value) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTIVE_STATUSES = ["pending_verification", "confirmed", "preparing", "ready"];
const FILTERS = [
  { key: "active", label: "Active" },
  { key: "all", label: "All" },
  { key: "pending_verification", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "served", label: "Served" },
];

function KitchenOrderCard({ order, restaurant, onAdvance, onCancel, busy }) {
  const meta = ORDER_STATUS_META[order.status] || { label: order.status, tone: "pending" };
  const advanceTo = nextStatus(order.status);

  return (
    <article className="kds-card">
      <div className="kds-card-top">
        <div>
          <span className={`admin-order-status status-${order.status}`}>{meta.label}</span>
          <h3>
            #{order.id} · {order.tableNumber || "Walk-in"}
          </h3>
          <p className="kds-customer">{order.customerName || "Guest"}</p>
        </div>
        <div className="admin-order-meta">
          <strong>{formatCurrency(order.totalPrice)}</strong>
          <span>{formatTimestamp(order.createdAt)}</span>
        </div>
      </div>

      <div className="kds-items">
        {order.items.map((item) => (
          <div className="kds-item" key={`${order.id}-${item.menuItemId}`}>
            <span>
              <strong>{item.quantity}×</strong> {item.name}
            </span>
          </div>
        ))}
      </div>

      {order.specialRequest ? <p className="admin-order-note">⚠ {order.specialRequest}</p> : null}

      <div className="kds-actions">
        {order.status === "pending_verification" ? (
          <span className="kds-hint">Verify the guest code to confirm.</span>
        ) : null}

        {advanceTo ? (
          <button
            className="admin-primary-button"
            disabled={busy}
            onClick={() => onAdvance(order.id, advanceTo)}
          >
            {ORDER_STATUS_META[order.status]?.nextLabel || "Advance"}
          </button>
        ) : null}

        <button
          className="admin-secondary-button"
          onClick={() => printKitchenTicket({ restaurant, order })}
        >
          Print ticket
        </button>

        {!["served", "cancelled", "expired"].includes(order.status) ? (
          <button className="kds-cancel" disabled={busy} onClick={() => onCancel(order.id)}>
            Cancel
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function KitchenDisplay({ orders, restaurant, onChanged }) {
  const [filter, setFilter] = useState("active");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const visibleOrders = useMemo(() => {
    if (filter === "all") {
      return orders;
    }
    if (filter === "active") {
      return orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
    }
    return orders.filter((order) => order.status === filter);
  }, [orders, filter]);

  async function handleAdvance(orderId, status) {
    setBusyId(orderId);
    setError("");
    try {
      await advanceOrderStatus({ orderId, status });
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(orderId) {
    setBusyId(orderId);
    setError("");
    try {
      await cancelOrder({ orderId });
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-orders-section">
      <div className="admin-panel-head">
        <div>
          <p className="admin-section-label">Kitchen display</p>
          <h2>Live service queue</h2>
        </div>
        <div className="kds-filters">
          {FILTERS.map((entry) => (
            <button
              className={`kds-filter ${filter === entry.key ? "is-active" : ""}`}
              key={entry.key}
              onClick={() => setFilter(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      {visibleOrders.length === 0 ? (
        <p className="admin-empty">No orders in this view.</p>
      ) : (
        <div className="kds-grid">
          {visibleOrders.map((order) => (
            <KitchenOrderCard
              busy={busyId === order.id}
              key={order.id}
              onAdvance={handleAdvance}
              onCancel={handleCancel}
              order={order}
              restaurant={restaurant}
            />
          ))}
        </div>
      )}
    </section>
  );
}
