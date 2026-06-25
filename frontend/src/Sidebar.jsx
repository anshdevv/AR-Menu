import { Link } from "react-router-dom";
import "./Sidebar.css";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "⬛" },
  { key: "pos", label: "POS Terminal", icon: "🖥" },
  { key: "kitchen", label: "Kitchen", icon: "🔥" },
  { key: "floor", label: "Floor Plan", icon: "◻" },
  { key: "reservations", label: "Reservations", icon: "📅" },
  null,
  { key: "menu", label: "Menu", icon: "🍽" },
  { key: "tables", label: "Tables & QR", icon: "📱" },
  { key: "inventory", label: "Inventory", icon: "📦" },
  { key: "staff", label: "Staff", icon: "👥" },
  { key: "analytics", label: "Analytics", icon: "📊" },
];

export default function Sidebar({ restaurant, activeSection, onSection, onSignOut }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-brand">Mapolos</span>
        <p className="sidebar-restaurant">{restaurant?.name || "Restaurant"}</p>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item, idx) => {
          if (!item) return <div key={idx} className="sidebar-divider" />;
          return (
            <button
              key={item.key}
              className={`sidebar-item${activeSection === item.key ? " is-active" : ""}`}
              onClick={() => onSection(item.key)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <Link className="sidebar-item sidebar-customer-link" to={`/?restaurant_id=${restaurant?.id || 1}&table=${restaurant?.sampleTable || "T-01"}`}>
          <span className="sidebar-icon">👁</span>
          <span>Customer view</span>
        </Link>
        <button className="sidebar-item sidebar-signout" onClick={onSignOut}>
          <span className="sidebar-icon">↩</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
