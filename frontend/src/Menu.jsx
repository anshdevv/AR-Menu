import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_RESTAURANT_ID,
  createOrder,
  formatCurrency,
  getOrderStatus,
  getRestaurantCatalog,
} from "./orderService";
import "./Menu.css";

const MODEL_VIEWER_SRC = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
const RECEIPT_STORAGE_PREFIX = "mapolos-customer-receipt";

const ORDER_STAGES = [
  {
    key: "pending_verification",
    label: "Pending confirmation",
    detail: "Show the 6-digit code to a staff member so the kitchen can begin.",
  },
  {
    key: "preparing",
    label: "Preparing",
    detail: "Your order is in the kitchen and the dishes are being cooked.",
  },
  {
    key: "plating",
    label: "Plating",
    detail: "Final garnish and quality check before service.",
  },
  {
    key: "serving",
    label: "Serving",
    detail: "Your order is on its way to the table.",
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

function getDisplayedOrderState(receipt, nowValue) {
  if (!receipt) {
    return {
      activeIndex: 0,
      badgeLabel: "Pending confirmation",
      badgeTone: "pending",
      helper:
        "Place the order and show your one-time code to a staff member to move it into the kitchen queue.",
    };
  }

  if (receipt.status === "expired") {
    return {
      activeIndex: 0,
      badgeLabel: "Expired",
      badgeTone: "expired",
      helper: "This verification code has expired. Start a new order if you still want these dishes.",
    };
  }

  if (receipt.status === "pending_verification" || !receipt.isVerified) {
    return {
      activeIndex: 0,
      badgeLabel: "Awaiting confirmation",
      badgeTone: "pending",
      helper: "Show the code below to the manager or server so the kitchen can begin preparing it.",
    };
  }

  const timelineStart = new Date(receipt.verifiedAt || receipt.createdAt || nowValue).getTime();
  const elapsedMinutes = Math.max(0, (nowValue - timelineStart) / 60000);

  if (elapsedMinutes < 4) {
    return {
      activeIndex: 1,
      badgeLabel: "Preparing",
      badgeTone: "active",
      helper: "Your order has been verified and is now being prepared by the kitchen.",
    };
  }

  if (elapsedMinutes < 8) {
    return {
      activeIndex: 2,
      badgeLabel: "Plating",
      badgeTone: "active",
      helper: "The kitchen is finishing your order and arranging the plates for service.",
    };
  }

  return {
    activeIndex: 3,
    badgeLabel: "Serving",
    badgeTone: "confirmed",
    helper: "Your order is leaving the pass and should be at your table shortly.",
  };
}

function StatusBadge({ label, tone }) {
  return <span className={`receipt-status tone-${tone}`}>{label}</span>;
}

function DishCard({ dish, quantity, onAdjustQuantity, onViewAr }) {
  return (
    <article className="dish-card">
      <div className="dish-card-image">
        <img alt={dish.name} src={dish.imageUrl} />
      </div>

      <div className="dish-card-body">
        <div className="dish-card-top">
          <div>
            <p className="section-label">{dish.category}</p>
            <h3>{dish.name}</h3>
          </div>
          <strong>{formatCurrency(dish.price)}</strong>
        </div>

        <p className="dish-card-description">{dish.description}</p>

        <div className="dish-card-footer">
          <button className="menu-secondary-button" onClick={() => onViewAr(dish)}>
            View in AR
          </button>

          <div className="dish-quantity-control">
            <button aria-label={`Remove ${dish.name}`} onClick={() => onAdjustQuantity(dish.id, -1)}>
              -
            </button>
            <span>{quantity}</span>
            <button aria-label={`Add ${dish.name}`} onClick={() => onAdjustQuantity(dish.id, 1)}>
              +
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CheckoutDrawer({
  cartItems,
  customerName,
  tableNumber,
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
    <div className="menu-modal-backdrop" onClick={onClose}>
      <section className="checkout-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="menu-panel-head">
          <div>
            <p className="section-label">Review order</p>
            <h2>Send it to the kitchen</h2>
          </div>
          <button className="menu-ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="checkout-line-items">
          {cartItems.map((item) => (
            <div className="checkout-line-item" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>{formatCurrency(item.price)}</p>
              </div>
              <div className="dish-quantity-control">
                <button onClick={() => onQuantityChange(item.id, -1)}>-</button>
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
              placeholder="Ayesha"
              value={customerName}
            />
          </label>

          <label className="menu-field">
            <span>Table number</span>
            <input
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
              rows={3}
              value={specialRequest}
            />
          </label>
        </div>

        <div className="checkout-summary">
          <span>Total</span>
          <strong>{formatCurrency(cartTotal)}</strong>
        </div>

        <button className="menu-primary-button checkout-submit" disabled={submitting} onClick={onSubmit}>
          {submitting ? "Sending order..." : "Place order"}
        </button>

        {submitError ? <p className="menu-inline-error">{submitError}</p> : null}
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
            ios-src={dish.arModelUrl.replace(".glb", ".usdz")}
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

function OrderStatusTimeline({ receipt, nowValue }) {
  const displayState = getDisplayedOrderState(receipt, nowValue);

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

function ReceiptPanel({ restaurant, receipt, onStartNewOrder, nowValue }) {
  const displayState = getDisplayedOrderState(receipt, nowValue);

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

      <OrderStatusTimeline nowValue={nowValue} receipt={receipt} />

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

      <button className="menu-secondary-button" onClick={onStartNewOrder}>
        Start another order
      </button>
    </section>
  );
}

export default function Menu() {
  const searchParams = new URLSearchParams(window.location.search);
  const restaurantId = searchParams.get("restaurant_id") || String(DEFAULT_RESTAURANT_ID);
  const scannedTable = searchParams.get("table") || "";

  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [catalogError, setCatalogError] = useState("");
  const [cart, setCart] = useState({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);
  const [arLoading, setArLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState(scannedTable);
  const [specialRequest, setSpecialRequest] = useState("");
  const [submitState, setSubmitState] = useState("idle");
  const [submitError, setSubmitError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [nowValue, setNowValue] = useState(Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowValue(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    setCatalogState("loading");
    setCatalogError("");

    getRestaurantCatalog(restaurantId)
      .then((result) => {
        if (ignore) {
          return;
        }

        const tableKey = scannedTable || result.restaurant.sampleTable || "";
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
  }, [restaurantId, scannedTable]);

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

        const storageTable = receipt.tableNumber || scannedTable || restaurant?.sampleTable || "";
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
  }, [receipt?.orderId, receipt?.verificationCode, restaurantId, scannedTable, restaurant?.sampleTable, receipt?.tableNumber]);

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

      const storageTable = tableNumber || scannedTable || restaurant?.sampleTable || "";
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
    const storageTable = tableNumber || scannedTable || restaurant?.sampleTable || "";
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
    <main className="menu-shell">
      <header className="restaurant-hero">
        <div>
          <p className="section-label">QR dining menu</p>
          <h1>{restaurant.name}</h1>
          <p className="restaurant-copy">{restaurant.description}</p>
        </div>

        <div className="restaurant-meta">
          <span>{restaurant.location}</span>
          <span>Table {tableNumber || scannedTable || restaurant.sampleTable}</span>
          <span>{menuItems.length} dishes ready to order</span>
        </div>
      </header>

      {receipt ? (
        <ReceiptPanel
          nowValue={nowValue}
          onStartNewOrder={handleStartNewOrder}
          receipt={receipt}
          restaurant={restaurant}
        />
      ) : (
        <>
          <section className="menu-overview">
            <div>
              <p className="section-label">Order from the table</p>
              <h2>Browse the dishes, preview them in AR, and place the order in a few taps.</h2>
            </div>
            <div className="menu-overview-side">
              <div className="overview-chip">No login required</div>
              <div className="overview-chip">Live order status</div>
              <div className="overview-chip">AR dish preview</div>
            </div>
          </section>

          {menuGroups.map(([category, items]) => (
            <section className="menu-section" key={category}>
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

      {cartCount > 0 && !receipt ? (
        <button className="cart-pill" onClick={() => setCheckoutOpen(true)}>
          <span>{cartCount} item(s)</span>
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
