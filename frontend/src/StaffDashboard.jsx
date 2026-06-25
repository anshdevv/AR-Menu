import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminSignIn,
  adminSignOut,
  clearAdminSessionToken,
  getAdminAnalytics,
  getAdminOrders,
  getAdminSession,
  getStoredAdminSessionToken,
  verifyOrderCode,
} from "./orderService";
import Analytics from "./Analytics";
import FloorPlan from "./FloorPlan";
import Inventory from "./Inventory";
import KitchenDisplay from "./KitchenDisplay";
import MenuManager from "./MenuManager";
import POSTerminal from "./POSTerminal";
import Reservations from "./Reservations";
import SaaSControl from "./SaaSControl";
import StaffOps from "./StaffOps";
import TablesManager from "./TablesManager";
import "./StaffDashboard.css";

const TABS = {
  command: { key: "command", label: "Command" },
  pos: { key: "pos", label: "POS" },
  floor: { key: "floor", label: "Floor" },
  kitchen: { key: "kitchen", label: "Kitchen" },
  reservations: { key: "reservations", label: "Reservations" },
  menu: { key: "menu", label: "Menu" },
  inventory: { key: "inventory", label: "Inventory" },
  staff: { key: "staff", label: "Staff" },
  tables: { key: "tables", label: "Tables & QR" },
  saas: { key: "saas", label: "SaaS" },
};

const ROLE_ACCESS = {
  owner: ["command", "pos", "floor", "kitchen", "reservations", "menu", "inventory", "staff", "tables", "saas"],
  manager: ["floor", "reservations", "menu", "inventory", "staff", "tables"],
  chef: ["kitchen"],
  counterstaff: ["pos"],
};

const ROLE_LABELS = {
  owner: "Owner",
  manager: "Manager",
  chef: "Chef",
  counterstaff: "Counter staff",
};

const ROLE_HOME = {
  owner: "command",
  manager: "menu",
  chef: "kitchen",
  counterstaff: "pos",
};

const DEMO_CREDENTIALS = [
  ["Owner", "owner@mapolos.com", "Owner@123"],
  ["Manager", "manager@mapolos.com", "Manager@123"],
  ["Chef", "chef@mapolos.com", "Chef@123"],
  ["Counter", "counter@mapolos.com", "Counter@123"],
];

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function rangeToIso(range) {
  const from = range.from ? new Date(`${range.from}T00:00:00`).toISOString() : null;
  const to = range.to ? new Date(`${range.to}T23:59:59`).toISOString() : null;
  return { from, to };
}

function LoginPanel({ email, password, onEmailChange, onPasswordChange, onSubmit, error, loading }) {
  return (
    <main className="admin-shell">
      <section className="admin-login-card">
        <div>
          <p className="admin-section-label">Protected staff portal</p>
          <h1>Staff access only.</h1>
          <p>
            Role-based access keeps owners, managers, chefs, and counter staff in the tools they
            actually need.
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
          <p>Demo credentials:</p>
          <div className="credential-grid">
            {DEMO_CREDENTIALS.map(([role, login, pass]) => (
              <code key={role}>{role}: {login} / {pass}</code>
            ))}
          </div>
        </div>

        <Link className="admin-secondary-button" to="/">
          Back to customer menus
        </Link>
      </section>
    </main>
  );
}

function VerifyPanel({ onVerified, verificationRate }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleVerify() {
    if (code.trim().length < 4) {
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const result = await verifyOrderCode({ code: code.trim() });
      setMessage(`Order #${result.orderId} confirmed.`);
      setCode("");
      setState("success");
      await onVerified();
    } catch (error) {
      setMessage(error.message);
      setState("error");
    }
  }

  return (
    <section className="admin-panel verify-panel">
      <div className="admin-panel-head">
        <div>
          <p className="admin-section-label">Code verification</p>
          <h2>Confirm guest orders</h2>
        </div>
        <span className="verification-rate">{verificationRate}% verified</span>
      </div>

      <div className="verify-form">
        <input
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleVerify();
            }
          }}
          placeholder="Enter customer code"
          value={code}
        />
        <button className="admin-primary-button" onClick={handleVerify}>
          {state === "loading" ? "Verifying..." : "Verify code"}
        </button>
      </div>

      {message ? (
        <p className={state === "error" ? "admin-error" : "admin-success"}>{message}</p>
      ) : null}
    </section>
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
  const [tab, setTab] = useState("command");
  const [range, setRange] = useState(defaultRange);

  useEffect(() => {
    const existingToken = getStoredAdminSessionToken();
    if (!existingToken) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function bootstrap() {
      try {
        const sessionData = await getAdminSession(existingToken);
        if (active) {
          setSession(sessionData);
          setTab(ROLE_HOME[sessionData.admin.role] || "command");
        }
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

  async function refreshOrders() {
    const nextOrders = await getAdminOrders();
    setOrders(nextOrders);
    return nextOrders;
  }

  async function refreshAnalytics(nextRange = range) {
    const nextAnalytics = await getAdminAnalytics(rangeToIso(nextRange));
    setAnalytics(nextAnalytics);
    return nextAnalytics;
  }

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    let active = true;

    async function loadDashboard() {
      try {
        const [nextAnalytics, nextOrders] = await Promise.all([
          getAdminAnalytics(rangeToIso(range)),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, range.from, range.to]);

  async function handleSignIn() {
    setAuthLoading(true);
    setAuthError("");
    try {
      await adminSignIn({ email, password });
      const sessionData = await getAdminSession();
      setSession(sessionData);
      setTab(ROLE_HOME[sessionData.admin.role] || "command");
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

  const verificationRate = analytics ? analytics.metrics.verificationRate : 0;
  const role = session.admin.role || "manager";
  const availableTabs = (ROLE_ACCESS[role] || ROLE_ACCESS.manager).map((key) => TABS[key]);
  const canUse = (key) => availableTabs.some((entry) => entry.key === key);
  const activeTab = canUse(tab) ? tab : availableTabs[0]?.key || "command";

  return (
    <main className="admin-shell">
      <header className="admin-hero">
        <div>
          <p className="admin-section-label">Restaurant management console</p>
          <h1>{session.restaurant.name}</h1>
          <p>
            Signed in as {ROLE_LABELS[role] || role}. Your workspace only shows authorized tools.
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

      <nav className="admin-tabs">
        {availableTabs.map((entry) => (
          <button
            className={`admin-tab ${activeTab === entry.key ? "is-active" : ""}`}
            key={entry.key}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {pageError ? <p className="admin-error">{pageError}</p> : null}

      {activeTab === "command" && canUse("command") ? (
        <Analytics analytics={analytics} onRangeChange={setRange} range={range} />
      ) : null}

      {activeTab === "pos" && canUse("pos") ? (
        <section className="admin-panel admin-feature-shell">
          <div className="admin-panel-head">
            <div>
              <p className="admin-section-label">Counter service</p>
              <h2>POS terminal</h2>
            </div>
          </div>
          <POSTerminal
            onOrderPlaced={async () => {
              await Promise.all([refreshOrders(), refreshAnalytics()]);
            }}
            restaurant={session.restaurant}
          />
        </section>
      ) : null}

      {activeTab === "floor" && canUse("floor") ? (
        <section className="admin-panel admin-feature-shell">
          <div className="admin-panel-head">
            <div>
              <p className="admin-section-label">Dining room</p>
              <h2>Live floor plan</h2>
            </div>
          </div>
          <FloorPlan
            onChanged={async () => {
              await Promise.all([refreshOrders(), refreshAnalytics()]);
            }}
          />
        </section>
      ) : null}

      {activeTab === "kitchen" && canUse("kitchen") ? (
        <>
          <VerifyPanel
            onVerified={async () => {
              await Promise.all([refreshOrders(), refreshAnalytics()]);
            }}
            verificationRate={verificationRate}
          />
          <KitchenDisplay
            onChanged={async () => {
              await Promise.all([refreshOrders(), refreshAnalytics()]);
            }}
            orders={orders}
            restaurant={session.restaurant}
          />
        </>
      ) : null}

      {activeTab === "reservations" && canUse("reservations") ? <Reservations /> : null}

      {activeTab === "menu" && canUse("menu") ? <MenuManager /> : null}

      {activeTab === "inventory" && canUse("inventory") ? <Inventory /> : null}

      {activeTab === "staff" && canUse("staff") ? <StaffOps /> : null}

      {activeTab === "tables" && canUse("tables") ? <TablesManager restaurant={session.restaurant} /> : null}

      {activeTab === "saas" && canUse("saas") ? <SaaSControl restaurant={session.restaurant} /> : null}
    </main>
  );
}
