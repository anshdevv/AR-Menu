import { useMemo, useState } from "react";

const BASE_FLAGS = [
  { key: "qr", label: "QR ordering", enabled: true },
  { key: "pickup", label: "Pickup ordering", enabled: true },
  { key: "ar", label: "AR menu", enabled: true },
  { key: "split", label: "Split billing", enabled: false },
  { key: "feedback", label: "Feedback requests", enabled: true },
  { key: "inventory", label: "Inventory automation", enabled: true },
];

const RESTAURANTS = [
  { name: "Mapolos Downtown", plan: "Growth", locations: 1, orders: 1842, mrr: 49000 },
  { name: "Mapolos Garden", plan: "Launch", locations: 1, orders: 721, mrr: 29000 },
  { name: "Bistro Eleven", plan: "Trial", locations: 2, orders: 318, mrr: 0 },
  { name: "Lahore Table Co.", plan: "Scale", locations: 4, orders: 5110, mrr: 119000 },
];

function money(value) {
  return new Intl.NumberFormat("en-PK", {
    currency: "PKR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export default function SaaSControl({ restaurant }) {
  const [flags, setFlags] = useState(BASE_FLAGS);
  const activeFlags = flags.filter((flag) => flag.enabled).length;
  const totals = useMemo(
    () => ({
      orders: RESTAURANTS.reduce((sum, item) => sum + item.orders, 0),
      mrr: RESTAURANTS.reduce((sum, item) => sum + item.mrr, 0),
      locations: RESTAURANTS.reduce((sum, item) => sum + item.locations, 0),
    }),
    [],
  );

  function toggleFlag(key) {
    setFlags((current) =>
      current.map((flag) => (flag.key === key ? { ...flag, enabled: !flag.enabled } : flag)),
    );
  }

  return (
    <div className="saas-wrap">
      <section className="saas-hero admin-panel">
        <div>
          <p className="admin-section-label">SaaS control plane</p>
          <h2>Launch, bill, and monitor every restaurant from one place.</h2>
          <p>
            Demo control center for onboarding, subscription status, feature access, and platform
            usage across the restaurant network.
          </p>
        </div>
        <div className="saas-plan-card">
          <span>Current tenant</span>
          <strong>{restaurant.name}</strong>
          <p>Growth plan · 1 location · AR and inventory enabled</p>
        </div>
      </section>

      <section className="admin-grid metrics-grid">
        <article className="metric-card">
          <span>Restaurants</span>
          <strong>{RESTAURANTS.length}</strong>
          <p>Live tenants in this demo network</p>
        </article>
        <article className="metric-card">
          <span>Locations</span>
          <strong>{totals.locations}</strong>
          <p>Single and multi-branch operators</p>
        </article>
        <article className="metric-card">
          <span>Monthly orders</span>
          <strong>{totals.orders.toLocaleString()}</strong>
          <p>Usage monitored for billing tiers</p>
        </article>
        <article className="metric-card">
          <span>MRR</span>
          <strong>{money(totals.mrr)}</strong>
          <p>Subscription revenue under management</p>
        </article>
      </section>

      <section className="admin-grid dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <p className="admin-section-label">Onboarding</p>
              <h2>Restaurant pipeline</h2>
            </div>
          </div>
          <div className="tenant-list">
            {RESTAURANTS.map((item) => (
              <div className="tenant-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.locations} location{item.locations > 1 ? "s" : ""} · {item.orders.toLocaleString()} orders</p>
                </div>
                <span>{item.plan}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <p className="admin-section-label">Feature flags</p>
              <h2>{activeFlags}/{flags.length} enabled</h2>
            </div>
          </div>
          <div className="flag-list">
            {flags.map((flag) => (
              <button
                className={`flag-row${flag.enabled ? " is-on" : ""}`}
                key={flag.key}
                onClick={() => toggleFlag(flag.key)}
              >
                <span>{flag.label}</span>
                <strong>{flag.enabled ? "On" : "Off"}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
