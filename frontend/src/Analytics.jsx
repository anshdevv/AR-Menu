import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "./orderService";

const PIE_COLORS = ["#c8a24a", "#7c6f9b", "#4a8fc8", "#5cb8a0", "#d07b6f", "#9b7c4a"];

function MetricCard({ label, value, hint }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function toCsv(analytics) {
  const rows = [["Section", "Key", "Orders/Qty", "Revenue"]];
  analytics.dailyRevenue.forEach((d) => rows.push(["Daily", d.label, d.orders, d.revenue]));
  analytics.hourly.forEach((h) => rows.push(["Hourly", `${h.hour}:00`, h.orders, h.revenue]));
  analytics.categoryBreakdown.forEach((c) =>
    rows.push(["Category", c.category, c.quantity, c.revenue]),
  );
  analytics.topItems.forEach((t) => rows.push(["Top item", t.name, t.quantity, t.revenue]));
  Object.entries(analytics.statusFunnel || {}).forEach(([status, count]) =>
    rows.push(["Status", status, count, ""]),
  );
  return rows.map((row) => row.map((cell) => `"${String(cell ?? "")}"`).join(",")).join("\n");
}

function exportCsv(analytics) {
  const blob = new Blob([toCsv(analytics)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mapolos-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Analytics({ analytics, range, onRangeChange }) {
  const peakHours = useMemo(
    () => (analytics ? analytics.hourly.filter((h) => h.orders > 0) : []),
    [analytics],
  );

  if (!analytics) {
    return <p>Loading analytics...</p>;
  }

  const { metrics } = analytics;

  return (
    <div className="analytics-wrap">
      <section className="admin-grid metrics-grid">
        <MetricCard hint="Orders placed since midnight" label="Orders today" value={metrics.ordersToday} />
        <MetricCard
          hint="Verified order revenue today"
          label="Revenue today"
          value={formatCurrency(metrics.revenueToday)}
        />
        <MetricCard
          hint="Average verified basket"
          label="Average ticket"
          value={formatCurrency(metrics.avgOrderValue)}
        />
        <MetricCard
          hint="Confirm → served, average"
          label="Avg prep time"
          value={`${metrics.avgPrepMinutes} min`}
        />
        <MetricCard
          hint="Distinct tables served today"
          label="Table turnover"
          value={metrics.tableTurnover}
        />
        <MetricCard
          hint="Orders waiting for staff"
          label="Pending verification"
          value={metrics.pendingVerification}
        />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-section-label">Reporting window</p>
            <h2>Filter &amp; export</h2>
          </div>
          <div className="analytics-controls">
            <label>
              <span>From</span>
              <input
                onChange={(e) => onRangeChange({ ...range, from: e.target.value })}
                type="date"
                value={range.from}
              />
            </label>
            <label>
              <span>To</span>
              <input
                onChange={(e) => onRangeChange({ ...range, to: e.target.value })}
                type="date"
                value={range.to}
              />
            </label>
            <button className="admin-secondary-button" onClick={() => exportCsv(analytics)}>
              Export CSV
            </button>
          </div>
        </div>
      </section>

      <section className="admin-grid dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <p className="admin-section-label">Revenue trend</p>
              <h2>Last 7 days</h2>
            </div>
          </div>
          <ResponsiveContainer height={240} width="100%">
            <BarChart data={analytics.dailyRevenue}>
              <CartesianGrid stroke="#2a2a35" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#8a8a99" />
              <YAxis stroke="#8a8a99" />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="revenue" fill="#c8a24a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <p className="admin-section-label">Peak hours</p>
              <h2>Orders by hour</h2>
            </div>
          </div>
          <ResponsiveContainer height={240} width="100%">
            <BarChart data={peakHours.length ? peakHours : analytics.hourly}>
              <CartesianGrid stroke="#2a2a35" strokeDasharray="3 3" />
              <XAxis dataKey="hour" stroke="#8a8a99" tickFormatter={(h) => `${h}:00`} />
              <YAxis allowDecimals={false} stroke="#8a8a99" />
              <Tooltip labelFormatter={(h) => `${h}:00`} />
              <Bar dataKey="orders" fill="#7c6f9b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </section>

      <section className="admin-grid dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <p className="admin-section-label">Category mix</p>
              <h2>Revenue by category</h2>
            </div>
          </div>
          {analytics.categoryBreakdown.length ? (
            <ResponsiveContainer height={240} width="100%">
              <PieChart>
                <Pie
                  data={analytics.categoryBreakdown}
                  dataKey="revenue"
                  nameKey="category"
                  outerRadius={90}
                >
                  {analytics.categoryBreakdown.map((entry, index) => (
                    <Cell fill={PIE_COLORS[index % PIE_COLORS.length]} key={entry.category} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="admin-empty">No category data in this window.</p>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <p className="admin-section-label">Top dishes</p>
              <h2>Best sellers</h2>
            </div>
          </div>
          <div className="top-items-list">
            {analytics.topItems.length ? (
              analytics.topItems.map((item) => (
                <div className="top-item-row" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.quantity} servings sold</p>
                  </div>
                  <span>{formatCurrency(item.revenue)}</span>
                </div>
              ))
            ) : (
              <p className="admin-empty">No sales in this window.</p>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
