import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { createTable, deleteTable, listTables, updateTable } from "./orderService";

function tableMenuUrl(qrToken) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?t=${qrToken}`;
}

function QrThumb({ qrToken }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(tableMenuUrl(qrToken), { width: 220, margin: 1 })
      .then((url) => {
        if (active) {
          setDataUrl(url);
        }
      })
      .catch(() => {
        if (active) {
          setDataUrl("");
        }
      });
    return () => {
      active = false;
    };
  }, [qrToken]);

  if (!dataUrl) {
    return <div className="qr-thumb qr-thumb-empty">QR</div>;
  }
  return <img alt="Table QR" className="qr-thumb" src={dataUrl} />;
}

async function downloadQr(table) {
  const dataUrl = await QRCode.toDataURL(tableMenuUrl(table.qrToken), { width: 600, margin: 2 });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `qr-${table.tableNumber}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function printAllQrs(tables, restaurantName) {
  const cards = await Promise.all(
    tables.map(async (table) => {
      const dataUrl = await QRCode.toDataURL(tableMenuUrl(table.qrToken), { width: 320, margin: 1 });
      return `
        <div class="qr-print-card">
          <h2>${table.tableNumber}</h2>
          <img src="${dataUrl}" alt="QR ${table.tableNumber}" />
          <p>Scan to view the menu &amp; order</p>
        </div>`;
    }),
  );

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    window.alert("Allow pop-ups to print QR codes.");
    return;
  }

  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${restaurantName} — Table QR codes</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 16px; }
      h1 { text-align: center; }
      .qr-print-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .qr-print-card { border: 1px solid #ccc; border-radius: 12px; padding: 16px; text-align: center; page-break-inside: avoid; }
      .qr-print-card h2 { margin: 0 0 8px; }
      .qr-print-card img { width: 100%; max-width: 220px; }
      .qr-print-card p { color: #555; font-size: 13px; }
    </style>
  </head>
  <body>
    <h1>${restaurantName} — Table QR codes</h1>
    <div class="qr-print-grid">${cards.join("")}</div>
  </body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 400);
}

export default function TablesManager({ restaurant }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ tableNumber: "", label: "", seats: "2" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listTables();
      setTables(data);
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

  async function handleCreate() {
    if (!form.tableNumber.trim()) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createTable({
        table: {
          tableNumber: form.tableNumber.trim(),
          label: form.label.trim(),
          seats: Number(form.seats || 2),
        },
      });
      setForm({ tableNumber: "", label: "", seats: "2" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(table) {
    setError("");
    try {
      await updateTable({ id: table.id, table: { isActive: !table.isActive } });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(table) {
    if (!window.confirm(`Delete table ${table.tableNumber}?`)) {
      return;
    }
    setError("");
    try {
      await deleteTable({ id: table.id });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <p className="admin-section-label">Tables &amp; QR</p>
          <h2>Generate table QR codes</h2>
        </div>
        {tables.length ? (
          <button
            className="admin-secondary-button"
            onClick={() => printAllQrs(tables, restaurant?.name || "Mapolos")}
          >
            Print all QR codes
          </button>
        ) : null}
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="tables-create">
        <input
          onChange={(e) => setForm((f) => ({ ...f, tableNumber: e.target.value }))}
          placeholder="Table number (e.g. T-13)"
          value={form.tableNumber}
        />
        <input
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="Label (e.g. Patio)"
          value={form.label}
        />
        <input
          inputMode="numeric"
          onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value.replace(/[^\d]/g, "") }))}
          placeholder="Seats"
          value={form.seats}
        />
        <button className="admin-primary-button" disabled={submitting} onClick={handleCreate}>
          {submitting ? "Adding..." : "Add table"}
        </button>
      </div>

      {loading ? (
        <p>Loading tables...</p>
      ) : (
        <div className="tables-grid">
          {tables.map((table) => (
            <article className={`table-card ${table.isActive ? "" : "is-inactive"}`} key={table.id}>
              <QrThumb qrToken={table.qrToken} />
              <div className="table-card-body">
                <h3>{table.tableNumber}</h3>
                <p>
                  {table.label || "—"} · {table.seats} seats
                </p>
                <span className={`menu-mgr-tag ${table.isActive ? "is-on" : "is-off"}`}>
                  {table.isActive ? "Active" : "Inactive"}
                </span>
                <div className="table-card-actions">
                  <button onClick={() => downloadQr(table)}>Download</button>
                  <button onClick={() => handleToggleActive(table)}>
                    {table.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button className="menu-mgr-delete" onClick={() => handleDelete(table)}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
