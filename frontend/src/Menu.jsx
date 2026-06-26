import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_RESTAURANT_ID,
  createOrder,
  formatCurrency,
  getOrderStatus,
  getRestaurantCatalog,
  resolveTable,
} from "./orderService";
import { printCustomerReceipt } from "./printing";
import "./Menu.css";

const MODEL_VIEWER_SRC = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
const RECEIPT_STORAGE_PREFIX = "mapolos-customer-receipt";

const ORDER_STAGES = [
  {
    key: "confirmed",
    label: "Confirmed",
    detail: "A staff member verified your code and the kitchen has the order.",
  },
  {
    key: "preparing",
    label: "Preparing",
    detail: "Your order is in the kitchen and the dishes are being cooked.",
  },
  {
    key: "ready",
    label: "Ready",
    detail: "Final garnish and quality check — your order is ready to leave the pass.",
  },
  {
    key: "served",
    label: "Served",
    detail: "Your order is on its way to the table. Enjoy!",
  },
];

let modelViewerLoader;

function ensureModelViewer() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.customElements?.get("model-viewer")) {
    return Promise.resolve();
  }

  if (!modelViewerLoader) {
    modelViewerLoader = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-model-viewer="true"]');

      if (existingScript) {
        existingScript.addEventListener("load", resolve, { once: true });
        existingScript.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.type = "module";
      script.src = MODEL_VIEWER_SRC;
      script.dataset.modelViewer = "true";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.appendChild(script);
    });
  }

  return modelViewerLoader;
}

function groupMenuItems(menuItems) {
  return menuItems.reduce((groups, item) => {
    const category = item.category || "Menu";
    const currentItems = groups.get(category) || [];
    currentItems.push(item);
    groups.set(category, currentItems);
    return groups;
  }, new Map());
}

function receiptStorageKey(restaurantId, tableNumber) {
  return `${RECEIPT_STORAGE_PREFIX}:${restaurantId || "unknown"}:${tableNumber || "service"}`;
}

function readReceipt(restaurantId, tableNumber) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(receiptStorageKey(restaurantId, tableNumber));

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function storeReceipt(restaurantId, tableNumber, receipt) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    receiptStorageKey(restaurantId, tableNumber),
    JSON.stringify(receipt),
  );
}

function clearReceipt(restaurantId, tableNumber) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(receiptStorageKey(restaurantId, tableNumber));
}

function getUsdzModelUrl(dish) {
  return dish.arModelUrl?.replace(/\.glb($|\?)/i, ".usdz$1") || "";
}

function isIphoneDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iPhone|iPod/i.test(navigator.userAgent) || navigator.platform === "iPhone";
}

function formatTimeLeft(isoValue) {
  if (!isoValue) {
    return "Expired";
  }

  const minutes = Math.ceil((new Date(isoValue).getTime() - Date.now()) / 60000);

  if (minutes <= 0) {
    return "Expired";
  }

  if (minutes === 1) {
    return "1 minute left";
  }

  return `${minutes} minutes left`;
}

// Maps the real, staff-driven order status onto the customer-facing timeline.
function getDisplayedOrderState(receipt) {
  if (!receipt || receipt.status === "pending_verification" || !receipt.isVerified) {
    if (receipt && receipt.status === "expired") {
      return {
        activeIndex: -1,
        badgeLabel: "Expired",
        badgeTone: "expired",
        helper:
          "This verification code has expired. Start a new order if you still want these dishes.",
      };
    }

    return {
      activeIndex: -1,
      badgeLabel: "Awaiting confirmation",
      badgeTone: "pending",
      helper:
        "Show the code below to the manager or server so the kitchen can begin preparing it.",
    };
  }

  switch (receipt.status) {
    case "confirmed":
      return {
        activeIndex: 0,
        badgeLabel: "Confirmed",
        badgeTone: "active",
        helper: "Your code was verified. The kitchen is about to start your order.",
      };
    case "preparing":
      return {
        activeIndex: 1,
        badgeLabel: "Preparing",
        badgeTone: "active",
        helper: "Your order is being prepared by the kitchen right now.",
      };
    case "ready":
      return {
        activeIndex: 2,
        badgeLabel: "Ready",
        badgeTone: "active",
        helper: "Your order is plated and ready — a server is bringing it over.",
      };
    case "served":
      return {
        activeIndex: 3,
        badgeLabel: "Served",
        badgeTone: "confirmed",
        helper: "Your order has been served. Enjoy your meal!",
      };
    case "cancelled":
      return {
        activeIndex: -1,
        badgeLabel: "Cancelled",
        badgeTone: "expired",
        helper: "This order was cancelled by staff. Please speak to a server if this is unexpected.",
      };
    default:
      return {
        activeIndex: 0,
        badgeLabel: "Confirmed",
        badgeTone: "active",
        helper: "Your order is confirmed.",
      };
  }
}

function StatusBadge({ label, tone }) {
  return <span className={`receipt-status tone-${tone}`}>{label}</span>;
}

function DishCard({ dish, isIphone, quantity, onAdjustQuantity, onViewAr }) {
  const usdzModelUrl = getUsdzModelUrl(dish);

  return (
    <article className="dish-card">
      <div className="dish-card-image">
        <img alt={dish.name} src={dish.imageUrl} />
        {isIphone && usdzModelUrl ? (
          <a className="dish-ar-chip" href={usdzModelUrl} rel="ar">
            <img alt="" aria-hidden="true" src={dish.imageUrl} />
            <span>View in AR</span>
          </a>
        ) : (
          <button
            className="dish-ar-chip"
            onClick={() => onViewAr(dish)}
            type="button"
          >
            View in AR
          </button>
        )}
      </div>

      <div className="dish-card-body">
        <div className="dish-card-top">
          <h3>{dish.name}</h3>
          <strong>{formatCurrency(dish.price)}</strong>
        </div>

        <p className="dish-card-description">{dish.description}</p>

        <div className="dish-card-footer">
          {quantity > 0 ? (
            <div className="dish-quantity-control">
              <button
                aria-label={`Remove ${dish.name}`}
                onClick={() => onAdjustQuantity(dish.id, -1)}
              >
                −
              </button>
              <span>{quantity}</span>
              <button aria-label={`Add ${dish.name}`} onClick={() => onAdjustQuantity(dish.id, 1)}>
                +
              </button>
            </div>
          ) : (
            <button className="dish-add-button" onClick={() => onAdjustQuantity(dish.id, 1)}>
              Add to order
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function CheckoutDrawer({
  cartItems,
  customerName,
  tableNumber,
  tableLocked,
  specialRequest,
  onCustomerNameChange,
  onTableNumberChange,
  onSpecialRequestChange,
  onQuantityChange,
  onClose,
  onSubmit,
  submitting,
  submitError,
}) {
  const cartTotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <div className="menu-sheet-backdrop" onClick={onClose}>
      <section className="checkout-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-grip" />

        <div className="checkout-sheet-head">
          <h2>Your order</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="checkout-sheet-body">
          <div className="checkout-line-items">
            {cartItems.map((item) => (
              <div className="checkout-line-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{formatCurrency(item.price)}</p>
                </div>
                <div className="dish-quantity-control">
                  <button onClick={() => onQuantityChange(item.id, -1)}>−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => onQuantityChange(item.id, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="checkout-fields">
            <label className="menu-field">
              <span>Name (optional)</span>
              <input
                onChange={(event) => onCustomerNameChange(event.target.value)}
                placeholder="Your name"
                value={customerName}
              />
            </label>

            <label className="menu-field">
              <span>Table number {tableLocked ? "(from QR)" : ""}</span>
              <input
                disabled={tableLocked}
                onChange={(event) => onTableNumberChange(event.target.value)}
                placeholder="T-12"
                value={tableNumber}
              />
            </label>

            <label className="menu-field">
              <span>Special request (optional)</span>
              <textarea
                onChange={(event) => onSpecialRequestChange(event.target.value)}
                placeholder="No onions, extra cutlery, serve later..."
                rows={2}
                value={specialRequest}
              />
            </label>
          </div>

          {submitError ? <p className="menu-inline-error">{submitError}</p> : null}
        </div>

        <div className="checkout-sheet-footer">
          <div className="checkout-summary">
            <span>Total</span>
            <strong>{formatCurrency(cartTotal)}</strong>
          </div>
          <button className="menu-primary-button checkout-submit" disabled={submitting} onClick={onSubmit}>
            {submitting ? "Sending order..." : "Place order"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ArModal({ dish, loading, onClose, onModelLoad }) {
  const viewerRef = useRef(null);

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer) {
      return undefined;
    }

    const handleLoad = () => onModelLoad();
    viewer.addEventListener("load", handleLoad);

    return () => {
      viewer.removeEventListener("load", handleLoad);
    };
  }, [dish.id, onModelLoad]);

  return (
    <div className="menu-modal-backdrop" onClick={onClose}>
      <section className="ar-modal" onClick={(event) => event.stopPropagation()}>
        <div className="menu-panel-head">
          <div>
            <p className="section-label">AR preview</p>
            <h2>{dish.name}</h2>
          </div>
          <button className="menu-ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="ar-modal-copy">
          Rotate, zoom, and use the AR button on supported phones to place the dish on the table at
          real-world scale.
        </p>

        <div className="ar-viewer-shell">
          {loading ? <div className="ar-loading">Loading 3D model...</div> : null}
          <model-viewer
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            ios-src={getUsdzModelUrl(dish)}
            ref={viewerRef}
            shadow-intensity="1"
            src={dish.arModelUrl}
            style={{ width: "100%", height: "100%" }}
            touch-action="pan-y"
          >
            <button className="menu-primary-button ar-launch-button" slot="ar-button">
              View in your space
            </button>
          </model-viewer>
        </div>
      </section>
    </div>
  );
}

function OrderStatusTimeline({ receipt }) {
  const displayState = getDisplayedOrderState(receipt);

  return (
    <section className="order-status-card">
      <div className="order-status-head">
        <div>
          <p className="section-label">Live order status</p>
          <h3>{displayState.badgeLabel}</h3>
        </div>
        <StatusBadge label={displayState.badgeLabel} tone={displayState.badgeTone} />
      </div>

      <p className="order-status-copy">{displayState.helper}</p>

      <div className="order-status-steps">
        {ORDER_STAGES.map((stage, index) => {
          const isDone = index < displayState.activeIndex;
          const isActive = index === displayState.activeIndex;

          return (
            <div
              className={`order-status-step ${isDone ? "is-done" : ""} ${isActive ? "is-active" : ""}`}
              key={stage.key}
            >
              <div className="order-status-bullet">{index + 1}</div>
              <div>
                <strong>{stage.label}</strong>
                <p>{stage.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SplitBillPanel({ receipt }) {
  const orderItems = useMemo(
    () =>
      (receipt.items || []).map((item) => {
        const totalOrderedQty = Math.max(0, Number(item.quantity || 0));
        const lineTotal = Number(item.lineTotal || 0);
        const fallbackUnitPrice = Number(item.priceAtTime || 0);

        return {
          id: String(item.menuItemId),
          name: item.name,
          totalOrderedQty,
          unitPrice: totalOrderedQty > 0 ? lineTotal / totalOrderedQty : fallbackUnitPrice,
        };
      }),
    [receipt.items],
  );
  const [guests, setGuests] = useState([
    { id: "guest-1", name: "Guest 1", claimedItems: [] },
    { id: "guest-2", name: "Guest 2", claimedItems: [] },
  ]);

  const itemsById = useMemo(
    () => new Map(orderItems.map((item) => [item.id, item])),
    [orderItems],
  );

  const itemSubtotal = orderItems.reduce(
    (sum, item) => sum + item.unitPrice * item.totalOrderedQty,
    0,
  );
  const explicitTax = Math.max(0, Number(receipt.totalPrice || 0) - itemSubtotal);
  const taxAndCharges = explicitTax || itemSubtotal * 0.13;
  const claimedQuantityByItem = orderItems.reduce((summary, item) => {
    summary[item.id] = guests.reduce(
      (total, guest) =>
        total +
        guest.claimedItems
          .filter((claim) => claim.itemId === item.id)
          .reduce((guestTotal, claim) => guestTotal + Number(claim.qty || 0), 0),
      0,
    );
    return summary;
  }, {});
  const remainingItems = orderItems.map((item) => ({
    ...item,
    remainingQty: Math.max(0, item.totalOrderedQty - (claimedQuantityByItem[item.id] || 0)),
  }));
  const totalUnassignedQty = remainingItems.reduce((sum, item) => sum + item.remainingQty, 0);
  const allAssigned = orderItems.length > 0 && totalUnassignedQty === 0;

  const shares = guests.map((guest) => {
    const subtotal = guest.claimedItems.reduce((sum, claim) => {
      const item = itemsById.get(claim.itemId);
      return item ? sum + item.unitPrice * Number(claim.qty || 0) : sum;
    }, 0);
    const taxShare =
      allAssigned && itemSubtotal > 0 ? (subtotal / itemSubtotal) * taxAndCharges : 0;

    return {
      ...guest,
      subtotal,
      taxShare,
      total: subtotal + taxShare,
    };
  });

  function getRemainingQtyFromGuests(sourceGuests, itemId, guestIdToSkip, claimRowIdToSkip) {
    const item = itemsById.get(itemId);
    if (!item) return 0;

    const claimedElsewhere = sourceGuests.reduce(
      (total, guest) =>
        total +
        guest.claimedItems.reduce((guestTotal, claim) => {
          const isCurrentRow = guest.id === guestIdToSkip && claim.rowId === claimRowIdToSkip;
          if (claim.itemId !== itemId || isCurrentRow) return guestTotal;
          return guestTotal + Number(claim.qty || 0);
        }, 0),
      0,
    );

    return Math.max(0, item.totalOrderedQty - claimedElsewhere);
  }

  function getRemainingQty(itemId, guestIdToSkip, claimRowIdToSkip) {
    return getRemainingQtyFromGuests(guests, itemId, guestIdToSkip, claimRowIdToSkip);
  }

  function addGuest() {
    setGuests((current) => [
      ...current,
      { id: `guest-${Date.now()}`, name: `Guest ${current.length + 1}`, claimedItems: [] },
    ]);
  }

  function removeGuest(id) {
    setGuests((current) => {
      if (current.length <= 1) return current;
      return current.filter((guest) => guest.id !== id);
    });
  }

  function updateName(id, name) {
    setGuests((current) =>
      current.map((guest) => (guest.id === id ? { ...guest, name } : guest)),
    );
  }

  function addDishToGuest(guestId, itemId) {
    if (!itemId) return;

    setGuests((current) =>
      getRemainingQtyFromGuests(current, itemId) <= 0
        ? current
        : current.map((guest) =>
            guest.id === guestId
              ? {
                  ...guest,
                  claimedItems: [
                    ...guest.claimedItems,
                    { rowId: `claim-${Date.now()}-${Math.random()}`, itemId, qty: 1 },
                  ],
                }
              : guest,
          ),
    );
  }

  function updateClaimQty(guestId, rowId, qty) {
    setGuests((current) =>
      current.map((guest) => {
        if (guest.id !== guestId) return guest;

        const claimedItems = guest.claimedItems.map((claim) => {
          if (claim.rowId !== rowId) return claim;
          const maxQty = getRemainingQtyFromGuests(current, claim.itemId, guestId, rowId);
          const nextQty = Math.min(Math.max(0, Number(qty || 0)), maxQty);
          return { ...claim, qty: nextQty };
        });

        return { ...guest, claimedItems };
      }),
    );
  }

  function removeClaim(guestId, rowId) {
    setGuests((current) =>
      current.map((guest) =>
        guest.id === guestId
          ? {
              ...guest,
              claimedItems: guest.claimedItems.filter((claim) => claim.rowId !== rowId),
            }
          : guest,
      ),
    );
  }

  return (
    <section className="customer-tool-card">
      <div className="split-panel-head">
        <h3>Split the bill</h3>
        <button className="menu-secondary-button" onClick={addGuest}>
          Add guest
        </button>
      </div>

      <p className="split-divider-text">
        Add dishes under each guest. Tax is calculated after every ordered quantity is assigned.
      </p>

      <div className="split-remaining-pool">
        {remainingItems.some((item) => item.remainingQty > 0)
          ? remainingItems
              .filter((item) => item.remainingQty > 0)
              .map((item) => `${item.remainingQty}x ${item.name}`)
              .join(", ")
          : "All dishes assigned"}
      </div>

      <div className="split-guest-list">
        {shares.map((guest) => {
          const addableItems = remainingItems.filter((item) => item.remainingQty > 0);

          return (
            <div className="split-guest-card" key={guest.id}>
              <div className="split-guest-head">
                <input
                  aria-label={`${guest.name} name`}
                  className="split-guest-name"
                  onChange={(event) => updateName(guest.id, event.target.value)}
                  value={guest.name}
                />
                <button aria-label={`Remove ${guest.name}`} onClick={() => removeGuest(guest.id)}>
                  Remove
                </button>
              </div>

              <div className="split-claim-list">
                {guest.claimedItems.length === 0 ? (
                  <p className="split-empty-state">No dishes added yet.</p>
                ) : null}

                {guest.claimedItems.map((claim) => {
                  const item = itemsById.get(claim.itemId);
                  if (!item) return null;
                  const maxQty = getRemainingQty(claim.itemId, guest.id, claim.rowId);

                  return (
                    <div className="split-claim-row" key={claim.rowId}>
                      <div className="split-claim-main">
                        <strong>{item.name}</strong>
                        <span>
                          {formatCurrency(item.unitPrice)} each - {formatCurrency(item.unitPrice * claim.qty)}
                        </span>
                      </div>
                      <input
                        aria-label={`${item.name} quantity for ${guest.name}`}
                        className="split-qty-input"
                        max={maxQty}
                        min="0"
                        onChange={(event) => updateClaimQty(guest.id, claim.rowId, event.target.value)}
                        type="number"
                        value={claim.qty}
                      />
                      <button
                        aria-label={`Remove ${item.name} from ${guest.name}`}
                        onClick={() => removeClaim(guest.id, claim.rowId)}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="split-add-dish-row">
                <select
                  aria-label={`Add dish for ${guest.name}`}
                  disabled={addableItems.length === 0}
                  onChange={(event) => {
                    addDishToGuest(guest.id, event.target.value);
                    event.target.value = "";
                  }}
                  value=""
                >
                  <option value="">Add dish</option>
                  {addableItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.remainingQty} left)
                    </option>
                  ))}
                </select>
              </div>

              <div className="split-person-row">
                <div>
                  <span>Subtotal {formatCurrency(guest.subtotal)}</span>
                  <small>
                    {allAssigned
                      ? `Tax share ${formatCurrency(guest.taxShare)}`
                      : `${totalUnassignedQty} item${totalUnassignedQty === 1 ? "" : "s"} left + tax pending`}
                  </small>
                </div>
                <strong>{formatCurrency(guest.total)}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FeedbackPanel() {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <section className="customer-tool-card customer-tool-success">
        <h3>Thank you</h3>
        <p>Your feedback was shared with the restaurant team.</p>
      </section>
    );
  }

  return (
    <section className="customer-tool-card">
      <div>
        <h3>Leave feedback</h3>
        <p>Tell the restaurant how the food and service felt today.</p>
      </div>
      <div className="rating-row" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            className={value <= rating ? "is-active" : ""}
            key={value}
            onClick={() => setRating(value)}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="feedback-textarea"
        onChange={(event) => setComment(event.target.value)}
        placeholder="What stood out?"
        rows={3}
        value={comment}
      />
      <button className="menu-primary-button customer-tool-action" onClick={() => setSent(true)}>
        Submit feedback
      </button>
    </section>
  );
}

function ReceiptPanel({ restaurant, receipt, onStartNewOrder }) {
  const displayState = getDisplayedOrderState(receipt);
  const [activeTool, setActiveTool] = useState("split");

  return (
    <section className="receipt-panel">
      <div className="menu-panel-head">
        <div>
          <p className="section-label">Order received</p>
          <h2>{restaurant.name}</h2>
        </div>
        <StatusBadge label={displayState.badgeLabel} tone={displayState.badgeTone} />
      </div>

      <div className="receipt-code-block">
        {receipt.verificationCode.split("").map((digit, index) => (
          <span className="receipt-code-digit" key={`${digit}-${index}`}>
            {digit}
          </span>
        ))}
      </div>

      <p className="receipt-copy">
        Show this code to the staff member at your table. After verification, this screen updates
        through preparing, plating, and serving. Code window: {formatTimeLeft(receipt.expiresAt)}.
      </p>

      <OrderStatusTimeline receipt={receipt} />

      <div className="receipt-grid">
        <div>
          <span>Order</span>
          <strong>#{receipt.orderId}</strong>
        </div>
        <div>
          <span>Table</span>
          <strong>{receipt.tableNumber || "Walk-in"}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{formatCurrency(receipt.totalPrice)}</strong>
        </div>
        <div>
          <span>Verified</span>
          <strong>{receipt.isVerified ? "Yes" : "Waiting"}</strong>
        </div>
      </div>

      <div className="receipt-items">
        {receipt.items.map((item) => (
          <div className="receipt-item" key={item.menuItemId}>
            <span>
              {item.quantity}x {item.name}
            </span>
            <strong>{formatCurrency(item.lineTotal)}</strong>
          </div>
        ))}
      </div>

      <div className="customer-tools">
        <div className="customer-tool-tabs">
          <button
            className={activeTool === "split" ? "is-active" : ""}
            onClick={() => setActiveTool("split")}
          >
            Split bill
          </button>
          <button
            className={activeTool === "feedback" ? "is-active" : ""}
            onClick={() => setActiveTool("feedback")}
          >
            Feedback
          </button>
        </div>
        {activeTool === "split" ? <SplitBillPanel receipt={receipt} /> : <FeedbackPanel />}
      </div>

      <div className="receipt-actions">
        <button
          className="menu-secondary-button"
          onClick={() => printCustomerReceipt({ restaurant, receipt })}
        >
          Print receipt
        </button>
        <button className="menu-secondary-button" onClick={onStartNewOrder}>
          Start another order
        </button>
      </div>
    </section>
  );
}

export default function Menu() {
  const searchParams = new URLSearchParams(window.location.search);
  const qrToken = searchParams.get("t") || "";
  const paramRestaurantId = searchParams.get("restaurant_id") || String(DEFAULT_RESTAURANT_ID);
  const paramTable = searchParams.get("table") || "";

  const [restaurantId, setRestaurantId] = useState(paramRestaurantId);
  const [tableId, setTableId] = useState(null);
  const [tableLocked, setTableLocked] = useState(Boolean(qrToken));
  const [qrPending, setQrPending] = useState(Boolean(qrToken));
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [catalogError, setCatalogError] = useState("");
  const [cart, setCart] = useState({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);
  const [arLoading, setArLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState(paramTable);
  const [specialRequest, setSpecialRequest] = useState("");
  const [submitState, setSubmitState] = useState("idle");
  const [submitError, setSubmitError] = useState("");
  const [receipt, setReceipt] = useState(null);

  // Resolve the table (and its restaurant) from a scanned QR token.
  useEffect(() => {
    if (!qrToken) {
      return undefined;
    }

    let ignore = false;

    resolveTable(qrToken)
      .then((info) => {
        if (ignore) {
          return;
        }
        setRestaurantId(String(info.restaurantId));
        setTableId(info.tableId);
        setTableNumber(info.tableNumber);
        setTableLocked(true);
      })
      .catch(() => {
        if (!ignore) {
          setTableLocked(false);
        }
      })
      .finally(() => {
        if (!ignore) {
          setQrPending(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [qrToken]);

  useEffect(() => {
    if (qrPending) {
      return undefined;
    }

    let ignore = false;
    setCatalogState("loading");
    setCatalogError("");

    getRestaurantCatalog(restaurantId)
      .then((result) => {
        if (ignore) {
          return;
        }

        const tableKey = tableNumber || paramTable || result.restaurant.sampleTable || "";
        setRestaurant(result.restaurant);
        setMenuItems(result.menuItems);
        setTableNumber((currentValue) => currentValue || tableKey);
        setReceipt(readReceipt(restaurantId, tableKey));
        setCatalogState("success");
      })
      .catch((error) => {
        if (ignore) {
          return;
        }

        setCatalogError(error.message);
        setCatalogState("error");
      });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, qrPending]);

  useEffect(() => {
    if (!selectedDish) {
      return;
    }

    setArLoading(true);
    ensureModelViewer().catch(() => {
      setArLoading(false);
    });
  }, [selectedDish]);

  useEffect(() => {
    if (!receipt?.orderId || !receipt?.verificationCode) {
      return;
    }

    let active = true;

    async function refreshOrderStatus() {
      try {
        const nextReceipt = await getOrderStatus(receipt.orderId, receipt.verificationCode);

        if (!active) {
          return;
        }

        const storageTable = receipt.tableNumber || paramTable || restaurant?.sampleTable || "";
        setReceipt(nextReceipt);
        storeReceipt(restaurantId, storageTable, nextReceipt);
      } catch {
        // Keep current state visible if refresh fails transiently.
      }
    }

    refreshOrderStatus();
    const intervalId = window.setInterval(refreshOrderStatus, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt?.orderId, receipt?.verificationCode, restaurantId, restaurant?.sampleTable, receipt?.tableNumber]);

  const cartItems = useMemo(
    () =>
      menuItems
        .map((item) => ({
          ...item,
          quantity: cart[item.id] || 0,
          menuItemId: item.id,
          lineTotal: (cart[item.id] || 0) * item.price,
        }))
        .filter((item) => item.quantity > 0),
    [cart, menuItems],
  );

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [cartItems],
  );

  const menuGroups = useMemo(() => Array.from(groupMenuItems(menuItems).entries()), [menuItems]);
  const isQrMenu = Boolean(qrToken);
  const isIphone = useMemo(() => isIphoneDevice(), []);

  function adjustQuantity(menuItemId, delta) {
    setCart((currentCart) => {
      const nextQuantity = Math.max(0, (currentCart[menuItemId] || 0) + delta);

      if (nextQuantity === 0) {
        const nextCart = { ...currentCart };
        delete nextCart[menuItemId];
        return nextCart;
      }

      return {
        ...currentCart,
        [menuItemId]: nextQuantity,
      };
    });
  }

  async function handleSubmitOrder() {
    if (!restaurantId || !cartItems.length) {
      return;
    }

    setSubmitState("submitting");
    setSubmitError("");

    try {
      const createdOrder = await createOrder({
        restaurantId,
        tableId,
        tableNumber,
        customerName,
        specialRequest,
        items: cartItems.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          name: item.name,
          priceAtTime: item.price,
          lineTotal: item.lineTotal,
        })),
      });

      const nextReceipt = {
        ...createdOrder,
        customerName,
        tableNumber,
        specialRequest,
        isVerified: false,
        items: cartItems.map((item) => ({
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          priceAtTime: item.price,
          lineTotal: item.lineTotal,
        })),
      };

      const storageTable = tableNumber || paramTable || restaurant?.sampleTable || "";
      setReceipt(nextReceipt);
      storeReceipt(restaurantId, storageTable, nextReceipt);
      setCart({});
      setCheckoutOpen(false);
      setSubmitState("success");
    } catch (error) {
      setSubmitState("error");
      setSubmitError(error.message);
    }
  }

  function handleStartNewOrder() {
    const storageTable = tableNumber || paramTable || restaurant?.sampleTable || "";
    clearReceipt(restaurantId, storageTable);
    setReceipt(null);
    setCustomerName("");
    setSpecialRequest("");
    setSubmitError("");
    setSubmitState("idle");
  }

  if (catalogState === "loading" || !restaurant) {
    return (
      <main className="menu-shell menu-state-shell">
        <p>Loading restaurant menu...</p>
      </main>
    );
  }

  if (catalogState === "error") {
    return (
      <main className="menu-shell menu-state-shell">
        <p className="menu-inline-error">{catalogError}</p>
      </main>
    );
  }

  return (
    <main className={`menu-shell ${isQrMenu ? "is-qr-menu" : ""}`}>
      {!isQrMenu ? (
      <nav className="menu-topbar">
        <a className="menu-brand" href="/">
          <span>Mapolos</span>
          <strong>OrderOS</strong>
        </a>
      </nav>
      ) : null}

      {!isQrMenu ? (
      <header className="restaurant-hero">
        <div>
          <h1>{restaurant.name}</h1>
          <p className="restaurant-copy">
            {restaurant.description} Order from the table, preview dishes in 3D, and track every
            step without waiting for the bill folder.
          </p>
          <div className="restaurant-actions">
            <button
              className="menu-primary-button"
              onClick={() => document.getElementById("menu-catalog")?.scrollIntoView({ behavior: "smooth" })}
            >
              Explore menu
            </button>
          </div>
        </div>

        <div className="restaurant-phone">
          <div className="phone-status-row">
            <span>Table {tableNumber || paramTable || restaurant.sampleTable}</span>
            <strong>{formatCurrency(cartTotal)}</strong>
          </div>
          <div className="phone-dish-stack">
            {menuItems.slice(0, 2).map((item) => (
              <div className="phone-dish-row" key={item.id}>
                <img alt="" src={item.imageUrl} />
                <div>
                  <strong>{item.name}</strong>
                  <span>{formatCurrency(item.price)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="phone-progress">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="restaurant-meta">
          <span>{restaurant.location}</span>
          <span>{menuItems.length} dishes ready</span>
          <span>AR previews</span>
          <span>Live order tracking</span>
        </div>
      </header>
      ) : (
        <header className="qr-menu-header">
          <div>
            <h1>{restaurant.name}</h1>
            <p>{restaurant.location}</p>
          </div>
          <div className="qr-table-chip">Table {tableNumber || paramTable || restaurant.sampleTable}</div>
        </header>
      )}

      {receipt ? (
        <ReceiptPanel
          onStartNewOrder={handleStartNewOrder}
          receipt={receipt}
          restaurant={restaurant}
        />
      ) : (
        <>
          {!isQrMenu ? (
          <section className="menu-overview">
            <div>
              <h2>Digital ordering restaurants can sell today.</h2>
            </div>
            <div className="menu-overview-side">
              <div className="overview-chip">QR ordering</div>
              <div className="overview-chip">Pickup-ready</div>
              <div className="overview-chip">Split bill demo</div>
              <div className="overview-chip">Kitchen sync</div>
            </div>
          </section>
          ) : null}

          {isQrMenu ? (
            <nav className="mobile-category-rail" aria-label="Menu categories">
              {menuGroups.map(([category]) => (
                <a href={`#category-${category.replace(/\s+/g, "-").toLowerCase()}`} key={category}>
                  {category}
                </a>
              ))}
            </nav>
          ) : null}

          {menuGroups.map(([category, items], index) => (
            <section
              className="menu-section"
              id={`category-${category.replace(/\s+/g, "-").toLowerCase()}`}
              key={category}
            >
              <span id={index === 0 ? "menu-catalog" : undefined} />
              <div className="menu-section-head">
                <div>
                  <p className="section-label">Category</p>
                  <h2>{category}</h2>
                </div>
                <p>{items.length} dishes</p>
              </div>

              <div className="dish-card-grid">
                {items.map((dish) => (
                  <DishCard
                    dish={dish}
                    isIphone={isIphone}
                    key={dish.id}
                    onAdjustQuantity={adjustQuantity}
                    onViewAr={setSelectedDish}
                    quantity={cart[dish.id] || 0}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {cartCount > 0 && !receipt && !checkoutOpen ? (
        <button className="cart-pill" onClick={() => setCheckoutOpen(true)}>
          <span className="cart-pill-count">{cartCount}</span>
          <span>View order</span>
          <strong>{formatCurrency(cartTotal)}</strong>
        </button>
      ) : null}

      {checkoutOpen ? (
        <CheckoutDrawer
          cartItems={cartItems}
          customerName={customerName}
          onClose={() => setCheckoutOpen(false)}
          onCustomerNameChange={setCustomerName}
          onQuantityChange={adjustQuantity}
          onSpecialRequestChange={setSpecialRequest}
          onSubmit={handleSubmitOrder}
          onTableNumberChange={setTableNumber}
          specialRequest={specialRequest}
          submitError={submitError}
          submitting={submitState === "submitting"}
          tableLocked={tableLocked}
          tableNumber={tableNumber}
        />
      ) : null}

      {selectedDish ? (
        <ArModal
          dish={selectedDish}
          loading={arLoading}
          onClose={() => setSelectedDish(null)}
          onModelLoad={() => setArLoading(false)}
        />
      ) : null}
    </main>
  );
}
