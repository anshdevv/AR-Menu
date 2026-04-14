import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminSignIn,
  adminSignOut,
  clearAdminSessionToken,
  formatCurrency,
  getAdminAnalytics,
  getAdminOrders,
  getAdminSession,
  getStoredAdminSessionToken,
  verifyOrderCode,
} from "./orderService";
import "./StaffDashboard.css";

function formatTimestamp(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LoginPanel({ email, password, onEmailChange, onPasswordChange, onSubmit, error, loading }) {
  return (
    <main className="admin-shell">
      <section className="admin-login-card">
        <div>
          <p className="admin-section-label">Protected staff portal</p>
          <h1>Manager access only.</h1>
          <p>
            This dashboard is protected by restaurant admin credentials and never exposed in the
            guest menu flow.
          </p>
        </div>

        <div className="admin-login-fields">
          <label className="admin-field">
            <span>Email</span>
            <input
              autoComplete="email"
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="manager@mapolos.com"
              value={email}
            />
          </label>

          <label className="admin-field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => onPasswordChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSubmit();
                }
              }}
              placeholder="••••••••••"
              type="password"
              value={password}
            />
          </label>
        </div>

        <button className="admin-primary-button" disabled={loading} onClick={onSubmit}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {error ? <p className="admin-error">{error}</p> : null}

        <div className="admin-login-help">
          <p>Demo credentials seeded in the SQL file:</p>
          <code>manager@mapolos.com / Mapolos@123</code>
        </div>

        <Link className="admin-secondary-button" to="/">
          Back to customer menus
        </Link>
      </section>
    </main>
  );
}

function MetricCard({ label, value, hint }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function RevenueChart({ items }) {
  const maxRevenue = Math.max(...items.map((item) => item.revenue), 1);

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <p className="admin-section-label">Revenue trend</p>
          <h2>Last 7 days</h2>
        </div>
      </div>

      <div className="revenue-chart">
        {items.map((item) => (
          <div className="revenue-bar-group" key={item.date}>
            <span className="revenue-bar-value">{formatCurrency(item.revenue)}</span>
            <div className="revenue-bar-track">
              <div
                className="revenue-bar-fill"
                style={{ height: `${Math.max(18, (item.revenue / maxRevenue) * 100)}%` }}
              />
            </div>
            <span className="revenue-bar-label">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TopItemsTable({ items }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <p className="admin-section-label">Top dishes</p>
          <h2>Best sellers</h2>
        </div>
      </div>

      <div className="top-items-list">
        {items.map((item) => (
          <div className="top-item-row" key={item.name}>
            <div>
              <strong>{item.name}</strong>
              <p>{item.quantity} servings sold</p>
            </div>
            <span>{formatCurrency(item.revenue)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function OrderCard({ order }) {
  return (
    <article className="admin-order-card">
      <div className="admin-order-top">
        <div>
          <span className={`admin-order-status status-${order.status}`}>{order.status.replace("_", " ")}</span>
          <h3>{order.customerName || "Walk-in order"}</h3>
        </div>
        <div className="admin-order-meta">
          <strong>{formatCurrency(order.totalPrice)}</strong>
          <span>{formatTimestamp(order.createdAt)}</span>
        </div>
      </div>

      <div className="admin-order-grid">
        <div>
          <span>Order</span>
          <strong>#{order.id}</strong>
        </div>
        <div>
          <span>Table</span>
          <strong>{order.tableNumber || "Walk-in"}</strong>
        </div>
        <div>
          <span>Verified</span>
          <strong>{order.isVerified ? "Yes" : "Pending"}</strong>
        </div>
        <div>
          <span>Code window</span>
          <strong>{formatTimestamp(order.expiresAt)}</strong>
        </div>
      </div>

      {order.specialRequest ? <p className="admin-order-note">{order.specialRequest}</p> : null}

      <div className="admin-order-items">
        {order.items.map((item) => (
          <div className="admin-order-item" key={`${order.id}-${item.menuItemId}`}>
            <span>
              {item.quantity}x {item.name}
            </span>
            <strong>{formatCurrency(item.lineTotal)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function StaffDashboard() {
  const [session, setSession] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationState, setVerificationState] = useState("idle");
  const [verificationMessage, setVerificationMessage] = useState("");

  useEffect(() => {
    const existingToken = getStoredAdminSessionToken();

    if (!existingToken) {
      setLoading(false);
      return;
    }

    let active = true;

    async function bootstrap() {
      try {
        const sessionData = await getAdminSession(existingToken);

        if (!active) {
          return;
        }

        setSession(sessionData);
      } catch {
        clearAdminSessionToken();
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let active = true;

    async function loadDashboard() {
      try {
        const [nextAnalytics, nextOrders] = await Promise.all([
          getAdminAnalytics(),
          getAdminOrders(),
        ]);

        if (!active) {
          return;
        }

        setAnalytics(nextAnalytics);
        setOrders(nextOrders);
        setPageError("");
      } catch (error) {
        if (!active) {
          return;
        }

        if (error.message.toLowerCase().includes("session")) {
          setSession(null);
          clearAdminSessionToken();
        }

        setPageError(error.message);
      }
    }

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [session]);

  const filteredOrders = useMemo(() => {
    return orders;
  }, [orders]);

  async function handleSignIn() {
    setAuthLoading(true);
    setAuthError("");

    try {
      await adminSignIn({ email, password });
      const sessionData = await getAdminSession();
      setSession(sessionData);
      setPassword("");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    await adminSignOut();
    setSession(null);
    setAnalytics(null);
    setOrders([]);
    setVerificationCode("");
    setVerificationMessage("");
  }

  async function handleVerifyCode() {
    if (verificationCode.trim().length < 4) {
      return;
    }

    setVerificationState("loading");
    setVerificationMessage("");

    try {
      const result = await verifyOrderCode({ code: verificationCode.trim() });
      setVerificationMessage(`Order #${result.orderId} confirmed.`);
      setVerificationCode("");
      const [nextAnalytics, nextOrders] = await Promise.all([getAdminAnalytics(), getAdminOrders()]);
      setAnalytics(nextAnalytics);
      setOrders(nextOrders);
      setVerificationState("success");
    } catch (error) {
      setVerificationMessage(error.message);
      setVerificationState("error");
    }
  }

  if (loading) {
    return (
      <main className="admin-shell admin-loading-shell">
        <p>Loading staff portal...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <LoginPanel
        email={email}
        error={authError}
        loading={authLoading}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleSignIn}
        password={password}
      />
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-hero">
        <div>
          <p className="admin-section-label">Authenticated manager dashboard</p>
          <h1>{session.restaurant.name}</h1>
          <p>
            Protected analytics, verification, and order monitoring for {session.restaurant.location}.
          </p>
        </div>

        <div className="admin-hero-actions">
          <Link className="admin-secondary-button" to={`/?restaurant_id=${session.restaurant.id}&table=${session.restaurant.sampleTable}`}>
            Open customer menu
          </Link>
          <button className="admin-primary-button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="admin-grid metrics-grid">
        <MetricCard
          hint="Orders placed since midnight"
          label="Orders today"
          value={analytics ? analytics.metrics.ordersToday : 0}
        />
        <MetricCard
          hint="Verified order revenue today"
          label="Revenue today"
          value={analytics ? formatCurrency(analytics.metrics.revenueToday) : formatCurrency(0)}
        />
        <MetricCard
          hint="Orders waiting for staff confirmation"
          label="Pending verification"
          value={analytics ? analytics.metrics.pendingVerification : 0}
        />
        <MetricCard
          hint="Average basket across all orders"
          label="Average ticket"
          value={analytics ? formatCurrency(analytics.metrics.avgOrderValue) : formatCurrency(0)}
        />
      </section>

      <section className="admin-grid dashboard-grid">
        <section className="admin-panel verify-panel">
          <div className="admin-panel-head">
            <div>
              <p className="admin-section-label">Code verification</p>
              <h2>Confirm guest orders</h2>
            </div>
            <span className="verification-rate">
              {analytics ? `${analytics.metrics.verificationRate}% verified` : "0% verified"}
            </span>
          </div>

          <div className="verify-form">
            <input
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleVerifyCode();
                }
              }}
              placeholder="Enter customer code"
              value={verificationCode}
            />
            <button className="admin-primary-button" onClick={handleVerifyCode}>
              {verificationState === "loading" ? "Verifying..." : "Verify code"}
            </button>
          </div>

          {verificationMessage ? (
            <p className={verificationState === "error" ? "admin-error" : "admin-success"}>
              {verificationMessage}
            </p>
          ) : null}
        </section>

        {analytics ? <RevenueChart items={analytics.dailyRevenue} /> : null}
      </section>

      <section className="admin-grid dashboard-grid">
        {analytics ? <TopItemsTable items={analytics.topItems} /> : null}

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <p className="admin-section-label">Access</p>
              <h2>Current admin session</h2>
            </div>
          </div>

          <div className="session-card">
            <div>
              <span>Email</span>
              <strong>{session.admin.email}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{session.admin.role}</strong>
            </div>
            <div>
              <span>Restaurant</span>
              <strong>{session.restaurant.name}</strong>
            </div>
            <div>
              <span>Sample table QR</span>
              <strong>{session.restaurant.sampleTable}</strong>
            </div>
          </div>
        </section>
      </section>

      <section className="admin-orders-section">
        <div className="admin-panel-head">
          <div>
            <p className="admin-section-label">Recent orders</p>
            <h2>Live service queue</h2>
          </div>
        </div>

        {pageError ? <p className="admin-error">{pageError}</p> : null}

        <div className="admin-orders-list">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      </section>
    </main>
  );
}
