import { supabase } from "./supabase";

export const DEFAULT_RESTAURANT_ID = 1;

const ADMIN_SESSION_STORAGE_KEY = "mapolos-admin-session";
const DEMO_ORDERS_STORAGE_KEY = "mapolos-demo-orders-v1";
const DEMO_ORDER_SEQUENCE_KEY = "mapolos-demo-order-seq-v1";
const DEMO_MENU_STORAGE_KEY = "mapolos-demo-menu-v1";
const DEMO_MENU_SEQUENCE_KEY = "mapolos-demo-menu-seq-v1";
const DEMO_TABLES_STORAGE_KEY = "mapolos-demo-tables-v1";
const DEMO_TABLE_SEQUENCE_KEY = "mapolos-demo-table-seq-v1";
const DEMO_SESSION_PREFIX = "demo-session";
const SCHEMA_MIGRATION_HINT =
  "Run the Supabase restaurant management SQL migration to enable secure orders and manager tools.";

// ---------------------------------------------------------------------------
// Shared order lifecycle definition (customer + staff)
// ---------------------------------------------------------------------------
export const ORDER_FLOW = ["confirmed", "preparing", "ready", "served"];

export const ORDER_STATUS_META = {
  pending_verification: { label: "Pending confirmation", tone: "pending" },
  confirmed: { label: "Confirmed", tone: "active", next: "preparing", nextLabel: "Start preparing" },
  preparing: { label: "Preparing", tone: "active", next: "ready", nextLabel: "Mark ready" },
  ready: { label: "Ready", tone: "active", next: "served", nextLabel: "Mark served" },
  served: { label: "Served", tone: "confirmed", next: null },
  expired: { label: "Expired", tone: "expired", next: null },
  cancelled: { label: "Cancelled", tone: "expired", next: null },
};

export function nextStatus(status) {
  return ORDER_STATUS_META[status]?.next || null;
}

const DEMO_RESTAURANTS = [
  {
    id: 1,
    name: "Mapolos Downtown",
    description:
      "A contemporary Italian dining room with fast QR ordering, elegant service pacing, and immersive AR previews for signature dishes.",
    location: "Main Boulevard, Karachi",
    sampleTable: "T-12",
  },
  {
    id: 2,
    name: "Mapolos Garden",
    description:
      "A lighter courtyard expression of Mapolos with calm lunch service and the same hero plates rendered in AR.",
    location: "Clifton Block 5, Karachi",
    sampleTable: "G-04",
  },
];

const DEMO_MENU_SEED = [
  {
    id: 1,
    restaurantId: 1,
    category: "Chef Signatures",
    name: "Chicken Alfredo",
    description:
      "Tender grilled chicken over fresh fettuccine with parmesan cream, lemon zest, and a glossy sauce finish.",
    price: 1690,
    arModelUrl: "/models/alfredo.glb",
    imageUrl: "/images/alfredo-card.svg",
    isAvailable: true,
    displayOrder: 1,
  },
  {
    id: 2,
    restaurantId: 1,
    category: "Chef Signatures",
    name: "Tarragon Chicken",
    description:
      "Slow-roasted chicken in a fragrant tarragon cream reduction with roasted vegetables and herb oil.",
    price: 1490,
    arModelUrl: "/models/tarragon.glb",
    imageUrl: "/images/tarragon-card.svg",
    isAvailable: true,
    displayOrder: 2,
  },
  {
    id: 3,
    restaurantId: 2,
    category: "Chef Signatures",
    name: "Chicken Alfredo",
    description:
      "Tender grilled chicken over fresh fettuccine with parmesan cream, lemon zest, and a glossy sauce finish.",
    price: 1690,
    arModelUrl: "/models/alfredo.glb",
    imageUrl: "/images/alfredo-card.svg",
    isAvailable: true,
    displayOrder: 1,
  },
  {
    id: 4,
    restaurantId: 2,
    category: "Chef Signatures",
    name: "Tarragon Chicken",
    description:
      "Slow-roasted chicken in a fragrant tarragon cream reduction with roasted vegetables and herb oil.",
    price: 1490,
    arModelUrl: "/models/tarragon.glb",
    imageUrl: "/images/tarragon-card.svg",
    isAvailable: true,
    displayOrder: 2,
  },
];

const DEMO_ADMINS = [
  { id: 1, email: "owner@mapolos.com", password: "Owner@123", restaurantId: 1, role: "owner" },
  { id: 2, email: "manager@mapolos.com", password: "Manager@123", restaurantId: 1, role: "manager" },
  { id: 3, email: "chef@mapolos.com", password: "Chef@123", restaurantId: 1, role: "chef" },
  { id: 4, email: "counter@mapolos.com", password: "Counter@123", restaurantId: 1, role: "counterstaff" },
  { id: 5, email: "garden@mapolos.com", password: "Garden@123", restaurantId: 2, role: "owner" },
];

function buildDemoTablesSeed() {
  const tables = [];
  let id = 1;
  for (let i = 1; i <= 12; i += 1) {
    tables.push({
      id: id++,
      restaurantId: 1,
      tableNumber: `T-${String(i).padStart(2, "0")}`,
      label: "Main floor",
      seats: 4,
      qrToken: `demo-token-1-${i}`,
      isActive: true,
    });
  }
  for (let i = 1; i <= 8; i += 1) {
    tables.push({
      id: id++,
      restaurantId: 2,
      tableNumber: `G-${String(i).padStart(2, "0")}`,
      label: "Courtyard",
      seats: 2,
      qrToken: `demo-token-2-${i}`,
      isActive: true,
    });
  }
  return tables;
}

function normalizeError(error, fallbackMessage) {
  if (error?.message) {
    return new Error(error.message);
  }
  return new Error(fallbackMessage);
}

function isMissingRpc(error) {
  const message = error?.message || "";
  return (
    message.includes("schema cache") ||
    message.includes("Could not find the function") ||
    message.includes("does not exist")
  );
}

function migrationRequiredError() {
  return new Error(SCHEMA_MIGRATION_HINT);
}

function isBrowser() {
  return typeof window !== "undefined";
}

function withTimeout(promise, milliseconds = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      globalThis.setTimeout(() => reject(new Error("Request timed out.")), milliseconds);
    }),
  ]);
}

function mapRestaurant(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    location: row.location,
    sampleTable: row.sample_table || "T-01",
  };
}

function mapMenuItem(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    category: row.category,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    arModelUrl: row.ar_model_url,
    imageUrl: row.image_url,
    isAvailable: row.is_available,
    displayOrder: row.display_order,
  };
}

function getRestaurantById(restaurantId) {
  return DEMO_RESTAURANTS.find((restaurant) => Number(restaurant.id) === Number(restaurantId));
}

function getDemoAdminByEmail(email) {
  return DEMO_ADMINS.find(
    (admin) => admin.email.toLowerCase() === String(email || "").trim().toLowerCase(),
  );
}

// ---------------------------------------------------------------------------
// Demo menu store (read/write so manager CRUD persists in demo mode)
// ---------------------------------------------------------------------------
function readDemoMenu() {
  if (!isBrowser()) {
    return DEMO_MENU_SEED.map((item) => ({ ...item }));
  }

  const existing = window.localStorage.getItem(DEMO_MENU_STORAGE_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // rebuild below
    }
  }

  const seed = DEMO_MENU_SEED.map((item) => ({ ...item }));
  window.localStorage.setItem(DEMO_MENU_STORAGE_KEY, JSON.stringify(seed));
  window.localStorage.setItem(
    DEMO_MENU_SEQUENCE_KEY,
    String(Math.max(...seed.map((item) => item.id))),
  );
  return seed;
}

function writeDemoMenu(items) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(DEMO_MENU_STORAGE_KEY, JSON.stringify(items));
  if (items.length) {
    window.localStorage.setItem(
      DEMO_MENU_SEQUENCE_KEY,
      String(Math.max(...items.map((item) => item.id))),
    );
  }
}

function nextDemoMenuId() {
  if (!isBrowser()) {
    return Math.max(...DEMO_MENU_SEED.map((item) => item.id)) + 1;
  }
  const stored = Number(window.localStorage.getItem(DEMO_MENU_SEQUENCE_KEY) || 100);
  const next = Number.isFinite(stored) ? stored + 1 : 101;
  window.localStorage.setItem(DEMO_MENU_SEQUENCE_KEY, String(next));
  return next;
}

function getMenuItemById(menuItemId) {
  return readDemoMenu().find((item) => Number(item.id) === Number(menuItemId));
}

function getDemoMenuForRestaurant(restaurantId) {
  return readDemoMenu()
    .filter((item) => Number(item.restaurantId) === Number(restaurantId))
    .sort(
      (left, right) =>
        String(left.category).localeCompare(String(right.category)) ||
        left.displayOrder - right.displayOrder,
    );
}

// ---------------------------------------------------------------------------
// Demo tables store
// ---------------------------------------------------------------------------
function readDemoTables() {
  if (!isBrowser()) {
    return buildDemoTablesSeed();
  }

  const existing = window.localStorage.getItem(DEMO_TABLES_STORAGE_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // rebuild below
    }
  }

  const seed = buildDemoTablesSeed();
  window.localStorage.setItem(DEMO_TABLES_STORAGE_KEY, JSON.stringify(seed));
  window.localStorage.setItem(
    DEMO_TABLE_SEQUENCE_KEY,
    String(Math.max(...seed.map((table) => table.id))),
  );
  return seed;
}

function writeDemoTables(tables) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(DEMO_TABLES_STORAGE_KEY, JSON.stringify(tables));
  if (tables.length) {
    window.localStorage.setItem(
      DEMO_TABLE_SEQUENCE_KEY,
      String(Math.max(...tables.map((table) => table.id))),
    );
  }
}

function nextDemoTableId() {
  if (!isBrowser()) {
    return Math.max(...buildDemoTablesSeed().map((table) => table.id)) + 1;
  }
  const stored = Number(window.localStorage.getItem(DEMO_TABLE_SEQUENCE_KEY) || 100);
  const next = Number.isFinite(stored) ? stored + 1 : 101;
  window.localStorage.setItem(DEMO_TABLE_SEQUENCE_KEY, String(next));
  return next;
}

function getDemoTablesForRestaurant(restaurantId) {
  return readDemoTables()
    .filter((table) => Number(table.restaurantId) === Number(restaurantId))
    .sort((left, right) => String(left.tableNumber).localeCompare(String(right.tableNumber)));
}

function getDemoTableByToken(qrToken) {
  return readDemoTables().find((table) => String(table.qrToken) === String(qrToken));
}

// ---------------------------------------------------------------------------
// Demo session helpers
// ---------------------------------------------------------------------------
function createDemoSessionToken(adminId) {
  return `${DEMO_SESSION_PREFIX}:${adminId}`;
}

function isDemoSessionToken(token) {
  return String(token || "").startsWith(`${DEMO_SESSION_PREFIX}:`);
}

function buildDemoAdminSession(admin) {
  const restaurant = getRestaurantById(admin.restaurantId);
  return {
    admin: { id: admin.id, email: admin.email, role: admin.role },
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description,
      location: restaurant.location,
      sampleTable: restaurant.sampleTable,
    },
  };
}

function getDemoSession(sessionToken = getStoredAdminSessionToken()) {
  if (!isDemoSessionToken(sessionToken)) {
    return null;
  }
  const adminId = Number(String(sessionToken).split(":")[1]);
  const admin = DEMO_ADMINS.find((entry) => Number(entry.id) === adminId);
  if (!admin) {
    return null;
  }
  return buildDemoAdminSession(admin);
}

function requireDemoSession(sessionToken) {
  const session = getDemoSession(sessionToken);
  if (!session) {
    throw new Error("Please sign in to continue.");
  }
  return session;
}

// ---------------------------------------------------------------------------
// Demo orders store
// ---------------------------------------------------------------------------
function demoDate(daysAgo, minutesAgo = 0) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - minutesAgo * 60 * 1000).toISOString();
}

function buildDemoSeedOrders() {
  return [
    {
      orderId: 7101,
      verificationCode: "483921",
      restaurantId: 1,
      tableId: 12,
      customerName: "Ayesha",
      tableNumber: "T-12",
      specialRequest: "Extra cutlery",
      status: "served",
      isVerified: true,
      totalPrice: 3180,
      createdAt: demoDate(0, 26),
      expiresAt: demoDate(0, 16),
      verifiedAt: demoDate(0, 22),
      confirmedAt: demoDate(0, 22),
      prepStartedAt: demoDate(0, 20),
      readyAt: demoDate(0, 12),
      servedAt: demoDate(0, 9),
      items: [
        { menuItemId: 1, name: "Chicken Alfredo", quantity: 1, priceAtTime: 1690, lineTotal: 1690 },
        { menuItemId: 2, name: "Tarragon Chicken", quantity: 1, priceAtTime: 1490, lineTotal: 1490 },
      ],
    },
    {
      orderId: 7102,
      verificationCode: "275644",
      restaurantId: 1,
      tableId: 9,
      customerName: "Bilal",
      tableNumber: "T-09",
      specialRequest: "",
      status: "pending_verification",
      isVerified: false,
      totalPrice: 1690,
      createdAt: demoDate(0, 8),
      expiresAt: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
      verifiedAt: null,
      confirmedAt: null,
      prepStartedAt: null,
      readyAt: null,
      servedAt: null,
      items: [
        { menuItemId: 1, name: "Chicken Alfredo", quantity: 1, priceAtTime: 1690, lineTotal: 1690 },
      ],
    },
    {
      orderId: 7201,
      verificationCode: "618205",
      restaurantId: 2,
      tableId: 16,
      customerName: "Hina",
      tableNumber: "G-04",
      specialRequest: "No pepper",
      status: "served",
      isVerified: true,
      totalPrice: 1490,
      createdAt: demoDate(1, 34),
      expiresAt: demoDate(1, 24),
      verifiedAt: demoDate(1, 29),
      confirmedAt: demoDate(1, 29),
      prepStartedAt: demoDate(1, 27),
      readyAt: demoDate(1, 20),
      servedAt: demoDate(1, 17),
      items: [
        { menuItemId: 4, name: "Tarragon Chicken", quantity: 1, priceAtTime: 1490, lineTotal: 1490 },
      ],
    },
  ];
}

function readDemoOrders() {
  if (!isBrowser()) {
    return buildDemoSeedOrders();
  }

  const existing = window.localStorage.getItem(DEMO_ORDERS_STORAGE_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // rebuild below
    }
  }

  const seedOrders = buildDemoSeedOrders();
  window.localStorage.setItem(DEMO_ORDERS_STORAGE_KEY, JSON.stringify(seedOrders));
  window.localStorage.setItem(
    DEMO_ORDER_SEQUENCE_KEY,
    String(Math.max(...seedOrders.map((order) => order.orderId))),
  );
  return seedOrders;
}

function writeDemoOrders(orders) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(DEMO_ORDERS_STORAGE_KEY, JSON.stringify(orders));
  if (orders.length) {
    const maxId = Math.max(...orders.map((order) => order.orderId));
    window.localStorage.setItem(DEMO_ORDER_SEQUENCE_KEY, String(maxId));
  }
}

function nextDemoOrderId() {
  if (!isBrowser()) {
    return Math.max(...buildDemoSeedOrders().map((order) => order.orderId)) + 1;
  }
  const storedValue = Number(window.localStorage.getItem(DEMO_ORDER_SEQUENCE_KEY) || 7300);
  const nextValue = Number.isFinite(storedValue) ? storedValue + 1 : 7301;
  window.localStorage.setItem(DEMO_ORDER_SEQUENCE_KEY, String(nextValue));
  return nextValue;
}

function generateVerificationCode() {
  return String(Math.floor(Math.random() * 900000) + 100000);
}

function buildOrderItems(items) {
  return items.map((item) => {
    const fallbackMenuItem = getMenuItemById(item.menuItemId);
    const priceAtTime = Number(item.priceAtTime ?? item.price ?? fallbackMenuItem?.price ?? 0);
    const name = item.name || fallbackMenuItem?.name || "Menu item";
    const quantity = Number(item.quantity || 0);
    return {
      menuItemId: Number(item.menuItemId),
      name,
      quantity,
      priceAtTime,
      lineTotal: Number(item.lineTotal ?? priceAtTime * quantity),
    };
  });
}

function createDemoOrderRecord({ restaurantId, tableId, tableNumber, customerName, specialRequest, items }) {
  const orderId = nextDemoOrderId();
  const createdAt = new Date().toISOString();
  const verificationCode = generateVerificationCode();
  const orderItems = buildOrderItems(items);
  const totalPrice = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    orderId,
    verificationCode,
    restaurantId: Number(restaurantId),
    tableId: tableId != null ? Number(tableId) : null,
    customerName: customerName || "",
    tableNumber: tableNumber || "",
    specialRequest: specialRequest || "",
    status: "pending_verification",
    isVerified: false,
    totalPrice,
    createdAt,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    verifiedAt: null,
    confirmedAt: null,
    prepStartedAt: null,
    readyAt: null,
    servedAt: null,
    items: orderItems,
  };
}

function upsertDemoOrder(order) {
  const orders = readDemoOrders();
  const nextOrders = orders.filter((entry) => Number(entry.orderId) !== Number(order.orderId));
  nextOrders.unshift(order);
  writeDemoOrders(nextOrders);
}

function getDemoOrder(orderId, verificationCode) {
  return readDemoOrders().find(
    (order) =>
      Number(order.orderId) === Number(orderId) &&
      String(order.verificationCode) === String(verificationCode),
  );
}

function getDemoOrdersForRestaurant(restaurantId) {
  return readDemoOrders()
    .filter((order) => Number(order.restaurantId) === Number(restaurantId))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

// ---------------------------------------------------------------------------
// Demo analytics
// ---------------------------------------------------------------------------
function buildDemoAnalyticsV2(restaurantId, fromValue, toValue) {
  const orders = getDemoOrdersForRestaurant(restaurantId);
  const from = fromValue ? new Date(fromValue).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
  const to = toValue ? new Date(toValue).getTime() : Date.now();
  const inRange = orders.filter((order) => {
    const createdAt = new Date(order.createdAt).getTime();
    return createdAt >= from && createdAt <= to;
  });

  const today = startOfToday().getTime();
  const ordersToday = orders.filter((order) => new Date(order.createdAt).getTime() >= today);
  const verifiedOrders = orders.filter((order) => order.isVerified);
  const revenueToday = ordersToday
    .filter((order) => order.isVerified)
    .reduce((sum, order) => sum + Number(order.totalPrice || 0), 0);
  const avgOrderValue =
    verifiedOrders.length > 0
      ? verifiedOrders.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0) /
        verifiedOrders.length
      : 0;
  const verificationRate =
    orders.length > 0 ? (verifiedOrders.length / orders.length) * 100 : 0;

  const prepTimes = orders
    .filter((order) => order.servedAt && order.confirmedAt)
    .map((order) => (new Date(order.servedAt).getTime() - new Date(order.confirmedAt).getTime()) / 60000);
  const avgPrepMinutes =
    prepTimes.length > 0 ? prepTimes.reduce((sum, value) => sum + value, 0) / prepTimes.length : 0;

  const tableTurnover = new Set(
    ordersToday.filter((order) => order.tableId != null).map((order) => order.tableId),
  ).size;

  const dailyRevenue = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const dayOrders = orders.filter((order) => {
      const createdAt = new Date(order.createdAt).getTime();
      return createdAt >= date.getTime() && createdAt < nextDate.getTime();
    });
    return {
      label: date.toLocaleDateString([], { weekday: "short" }),
      date: date.toISOString(),
      revenue: dayOrders
        .filter((order) => order.isVerified)
        .reduce((sum, order) => sum + Number(order.totalPrice || 0), 0),
      orders: dayOrders.length,
    };
  });

  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const hourOrders = inRange.filter((order) => new Date(order.createdAt).getHours() === hour);
    return {
      hour,
      orders: hourOrders.length,
      revenue: hourOrders
        .filter((order) => order.isVerified)
        .reduce((sum, order) => sum + Number(order.totalPrice || 0), 0),
    };
  });

  const categoryMap = new Map();
  const itemMap = new Map();
  inRange.forEach((order) => {
    order.items.forEach((item) => {
      const menuItem = getMenuItemById(item.menuItemId);
      const category = menuItem?.category || "Menu";
      const cat = categoryMap.get(category) || { category, quantity: 0, revenue: 0 };
      cat.quantity += Number(item.quantity || 0);
      cat.revenue += Number(item.lineTotal || 0);
      categoryMap.set(category, cat);

      const existing = itemMap.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
      existing.quantity += Number(item.quantity || 0);
      existing.revenue += Number(item.lineTotal || 0);
      itemMap.set(item.name, existing);
    });
  });

  const statusFunnel = {};
  inRange.forEach((order) => {
    statusFunnel[order.status] = (statusFunnel[order.status] || 0) + 1;
  });

  const categoryBreakdown = Array.from(categoryMap.values()).sort(
    (left, right) => right.revenue - left.revenue,
  );
  const topItems = Array.from(itemMap.values())
    .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
    .slice(0, 8);

  return {
    range: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
    metrics: {
      ordersToday: ordersToday.length,
      revenueToday,
      pendingVerification: orders.filter((order) => order.status === "pending_verification").length,
      avgOrderValue,
      verificationRate: Number(verificationRate.toFixed(1)),
      avgPrepMinutes: Number(avgPrepMinutes.toFixed(1)),
      tableTurnover,
    },
    dailyRevenue,
    hourly,
    categoryBreakdown,
    statusFunnel,
    topItems,
  };
}

function buildDemoOrdersPayload(restaurantId) {
  return getDemoOrdersForRestaurant(restaurantId).map((order) => ({
    id: order.orderId,
    customerName: order.customerName,
    tableNumber: order.tableNumber,
    specialRequest: order.specialRequest,
    status: order.status,
    totalPrice: Number(order.totalPrice || 0),
    isVerified: order.isVerified,
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt || null,
    prepStartedAt: order.prepStartedAt || null,
    readyAt: order.readyAt || null,
    servedAt: order.servedAt || null,
    expiresAt: order.expiresAt,
    items: order.items.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: Number(item.quantity || 0),
      priceAtTime: Number(item.priceAtTime || 0),
      lineTotal: Number(item.lineTotal || 0),
    })),
  }));
}

function verifyDemoOrder(code, sessionToken = getStoredAdminSessionToken()) {
  const session = requireDemoSession(sessionToken);
  const orders = readDemoOrders();
  const matchedIndex = orders.findIndex(
    (order) =>
      Number(order.restaurantId) === Number(session.restaurant.id) &&
      String(order.verificationCode) === String(code),
  );

  if (matchedIndex === -1) {
    throw new Error("Code not found for this restaurant.");
  }

  const matchedOrder = orders[matchedIndex];

  if (matchedOrder.isVerified || matchedOrder.status !== "pending_verification") {
    throw new Error("This order is already verified.");
  }

  if (new Date(matchedOrder.expiresAt).getTime() <= Date.now()) {
    orders[matchedIndex] = { ...matchedOrder, status: "expired", isVerified: false };
    writeDemoOrders(orders);
    throw new Error("This verification code has expired.");
  }

  const verifiedAt = new Date().toISOString();
  orders[matchedIndex] = {
    ...matchedOrder,
    status: "confirmed",
    isVerified: true,
    verifiedAt,
    confirmedAt: verifiedAt,
  };
  writeDemoOrders(orders);

  return { orderId: matchedOrder.orderId, status: "confirmed", verifiedAt };
}

function advanceDemoOrder(orderId, status, sessionToken = getStoredAdminSessionToken()) {
  const session = requireDemoSession(sessionToken);
  const orders = readDemoOrders();
  const index = orders.findIndex(
    (order) =>
      Number(order.orderId) === Number(orderId) &&
      Number(order.restaurantId) === Number(session.restaurant.id),
  );

  if (index === -1) {
    throw new Error("Order not found for this restaurant.");
  }

  const order = orders[index];
  const allowed =
    (order.status === "confirmed" && status === "preparing") ||
    (order.status === "preparing" && status === "ready") ||
    (order.status === "ready" && status === "served");

  if (!allowed) {
    throw new Error(`Cannot move order from ${order.status} to ${status}.`);
  }

  const now = new Date().toISOString();
  orders[index] = {
    ...order,
    status,
    prepStartedAt: status === "preparing" ? now : order.prepStartedAt,
    readyAt: status === "ready" ? now : order.readyAt,
    servedAt: status === "served" ? now : order.servedAt,
  };
  writeDemoOrders(orders);
  return { orderId: Number(orderId), status };
}

function cancelDemoOrder(orderId, sessionToken = getStoredAdminSessionToken()) {
  const session = requireDemoSession(sessionToken);
  const orders = readDemoOrders();
  const index = orders.findIndex(
    (order) =>
      Number(order.orderId) === Number(orderId) &&
      Number(order.restaurantId) === Number(session.restaurant.id),
  );

  if (index === -1) {
    throw new Error("Order not found for this restaurant.");
  }

  if (["served", "cancelled", "expired"].includes(orders[index].status)) {
    throw new Error("Order cannot be cancelled from its current state.");
  }

  orders[index] = { ...orders[index], status: "cancelled" };
  writeDemoOrders(orders);
  return { orderId: Number(orderId), status: "cancelled" };
}

// ---------------------------------------------------------------------------
// Public utilities
// ---------------------------------------------------------------------------
export function formatCurrency(value) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function getStoredAdminSessionToken() {
  if (!isBrowser()) {
    return "";
  }
  return window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || "";
}

export function storeAdminSessionToken(token) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, token);
}

export function clearAdminSessionToken() {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Customer: resolve table from QR token
// ---------------------------------------------------------------------------
export async function resolveTable(qrToken) {
  const { data, error } = await supabase.rpc("resolve_table", { p_qr_token: qrToken });

  if (error) {
    const demoTable = getDemoTableByToken(qrToken);
    if (demoTable) {
      const restaurant = getRestaurantById(demoTable.restaurantId);
      return {
        tableId: demoTable.id,
        tableNumber: demoTable.tableNumber,
        restaurantId: demoTable.restaurantId,
        restaurant,
      };
    }
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Table not found.");
  }

  return {
    tableId: data.tableId,
    tableNumber: data.tableNumber,
    restaurantId: data.restaurantId,
    restaurant: mapRestaurant({
      id: data.restaurant.id,
      name: data.restaurant.name,
      description: data.restaurant.description,
      location: data.restaurant.location,
      sample_table: data.restaurant.sampleTable,
    }),
  };
}

// ---------------------------------------------------------------------------
// Customer: catalog
// ---------------------------------------------------------------------------
export async function getRestaurantCatalog(restaurantId) {
  const fallbackRestaurant = getRestaurantById(restaurantId);
  const fallbackMenuItems = getDemoMenuForRestaurant(restaurantId).filter((item) => item.isAvailable);
  let restaurantResult;
  let menuResult;

  try {
    [restaurantResult, menuResult] = await withTimeout(
      Promise.all([
        supabase
          .from("restaurants")
          .select("id, name, description, location, sample_table")
          .eq("id", restaurantId)
          .single(),
        supabase
          .from("menu_items")
          .select(
            "id, restaurant_id, category, name, description, price, ar_model_url, image_url, is_available, display_order",
          )
          .eq("restaurant_id", restaurantId)
          .eq("is_available", true)
          .order("category", { ascending: true })
          .order("display_order", { ascending: true }),
      ]),
    );
  } catch {
    if (fallbackRestaurant) {
      return { restaurant: fallbackRestaurant, menuItems: fallbackMenuItems };
    }
    throw new Error("Unable to load restaurant catalog.");
  }

  if ((restaurantResult.error || !restaurantResult.data) && fallbackRestaurant) {
    return { restaurant: fallbackRestaurant, menuItems: fallbackMenuItems };
  }

  if (restaurantResult.error) {
    throw normalizeError(restaurantResult.error, "Restaurant not found.");
  }

  if (menuResult.error && !fallbackMenuItems.length) {
    throw normalizeError(menuResult.error, "Unable to load menu items.");
  }

  return {
    restaurant: mapRestaurant(restaurantResult.data),
    menuItems: (menuResult.data || fallbackMenuItems).map((item) =>
      "restaurant_id" in item ? mapMenuItem(item) : item,
    ),
  };
}

// ---------------------------------------------------------------------------
// Customer: create + poll order
// ---------------------------------------------------------------------------
export async function createOrder({ restaurantId, tableId, tableNumber, customerName, specialRequest, items }) {
  const payload = items.map((item) => ({
    menuItemId: item.menuItemId,
    quantity: item.quantity,
  }));

  const { data, error } = await supabase.rpc("create_order", {
    p_restaurant_id: Number(restaurantId),
    p_table_id: tableId != null ? Number(tableId) : null,
    p_table_number: tableNumber || null,
    p_customer_name: customerName || null,
    p_special_request: specialRequest || null,
    p_items: payload,
  });

  if (error) {
    const demoOrder = createDemoOrderRecord({
      restaurantId,
      tableId,
      tableNumber,
      customerName,
      specialRequest,
      items,
    });
    upsertDemoOrder(demoOrder);
    return {
      orderId: demoOrder.orderId,
      verificationCode: demoOrder.verificationCode,
      expiresAt: demoOrder.expiresAt,
      status: demoOrder.status,
      totalPrice: Number(demoOrder.totalPrice),
    };
  }

  const mirroredOrder = createDemoOrderRecord({
    restaurantId,
    tableId,
    tableNumber,
    customerName,
    specialRequest,
    items,
  });
  upsertDemoOrder({
    ...mirroredOrder,
    orderId: data.orderId,
    verificationCode: data.verificationCode,
    expiresAt: data.expiresAt,
    totalPrice: Number(data.totalPrice),
  });

  return {
    orderId: data.orderId,
    verificationCode: data.verificationCode,
    expiresAt: data.expiresAt,
    status: data.status,
    totalPrice: Number(data.totalPrice),
  };
}

export async function getOrderStatus(orderId, verificationCode) {
  const { data, error } = await supabase.rpc("get_order_status", {
    p_order_id: Number(orderId),
    p_code: verificationCode,
  });

  if (error) {
    const demoOrder = getDemoOrder(orderId, verificationCode);
    if (demoOrder) {
      return { ...demoOrder };
    }
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to refresh the order status.");
  }

  return {
    verificationCode,
    orderId: data.orderId,
    restaurantId: data.restaurantId,
    customerName: data.customerName,
    tableNumber: data.tableNumber,
    specialRequest: data.specialRequest,
    status: data.status,
    isVerified: data.isVerified,
    totalPrice: Number(data.totalPrice),
    createdAt: data.createdAt,
    confirmedAt: data.confirmedAt,
    prepStartedAt: data.prepStartedAt,
    readyAt: data.readyAt,
    servedAt: data.servedAt,
    expiresAt: data.expiresAt,
    verifiedAt: data.verifiedAt,
    items: (data.items || []).map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      priceAtTime: Number(item.priceAtTime),
      lineTotal: Number(item.lineTotal),
    })),
  };
}

// ---------------------------------------------------------------------------
// Admin auth
// ---------------------------------------------------------------------------
export async function adminSignIn({ email, password }) {
  const demoAdmin = getDemoAdminByEmail(email);

  const { data, error } = await supabase.rpc("admin_sign_in", {
    p_email: email,
    p_password: password,
  });

  if (error) {
    if (demoAdmin && demoAdmin.password === password) {
      const sessionToken = createDemoSessionToken(demoAdmin.id);
      storeAdminSessionToken(sessionToken);
      return {
        sessionToken,
        admin: {
          id: demoAdmin.id,
          email: demoAdmin.email,
          role: demoAdmin.role,
          restaurantId: demoAdmin.restaurantId,
          restaurantName: getRestaurantById(demoAdmin.restaurantId)?.name || "Mapolos",
        },
      };
    }
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to sign in.");
  }

  storeAdminSessionToken(data.sessionToken);
  return data;
}

export async function adminSignOut(sessionToken = getStoredAdminSessionToken()) {
  if (!sessionToken) {
    clearAdminSessionToken();
    return;
  }
  if (isDemoSessionToken(sessionToken)) {
    clearAdminSessionToken();
    return;
  }
  await supabase.rpc("admin_sign_out", { p_session_token: sessionToken });
  clearAdminSessionToken();
}

export async function getAdminSession(sessionToken = getStoredAdminSessionToken()) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    return demoSession;
  }
  if (!sessionToken) {
    throw new Error("Please sign in to continue.");
  }

  const { data, error } = await supabase.rpc("get_admin_session", { p_session_token: sessionToken });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    clearAdminSessionToken();
    throw normalizeError(error, "Unable to validate the admin session.");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Admin analytics (v2)
// ---------------------------------------------------------------------------
export async function getAdminAnalytics({ from, to } = {}, sessionToken = getStoredAdminSessionToken()) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    return buildDemoAnalyticsV2(demoSession.restaurant.id, from, to);
  }

  const { data, error } = await supabase.rpc("get_admin_analytics_v2", {
    p_session_token: sessionToken,
    p_from: from || null,
    p_to: to || null,
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    if (error.message?.toLowerCase().includes("session")) {
      clearAdminSessionToken();
    }
    throw normalizeError(error, "Unable to load analytics.");
  }

  return {
    range: data.range,
    metrics: {
      ordersToday: Number(data.metrics.ordersToday || 0),
      revenueToday: Number(data.metrics.revenueToday || 0),
      pendingVerification: Number(data.metrics.pendingVerification || 0),
      avgOrderValue: Number(data.metrics.avgOrderValue || 0),
      verificationRate: Number(data.metrics.verificationRate || 0),
      avgPrepMinutes: Number(data.metrics.avgPrepMinutes || 0),
      tableTurnover: Number(data.metrics.tableTurnover || 0),
    },
    dailyRevenue: (data.dailyRevenue || []).map((item) => ({
      label: item.label,
      date: item.date,
      revenue: Number(item.revenue || 0),
      orders: Number(item.orders || 0),
    })),
    hourly: (data.hourly || []).map((item) => ({
      hour: Number(item.hour || 0),
      orders: Number(item.orders || 0),
      revenue: Number(item.revenue || 0),
    })),
    categoryBreakdown: (data.categoryBreakdown || []).map((item) => ({
      category: item.category,
      quantity: Number(item.quantity || 0),
      revenue: Number(item.revenue || 0),
    })),
    statusFunnel: data.statusFunnel || {},
    topItems: (data.topItems || []).map((item) => ({
      name: item.name,
      quantity: Number(item.quantity || 0),
      revenue: Number(item.revenue || 0),
    })),
  };
}

// ---------------------------------------------------------------------------
// Admin orders + lifecycle
// ---------------------------------------------------------------------------
export async function getAdminOrders(sessionToken = getStoredAdminSessionToken()) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    return buildDemoOrdersPayload(demoSession.restaurant.id);
  }

  const { data, error } = await supabase.rpc("get_admin_orders", { p_session_token: sessionToken });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    if (error.message?.toLowerCase().includes("session")) {
      clearAdminSessionToken();
    }
    throw normalizeError(error, "Unable to load orders.");
  }

  return (data || []).map((order) => ({
    id: order.id,
    customerName: order.customerName,
    tableNumber: order.tableNumber,
    specialRequest: order.specialRequest,
    status: order.status,
    totalPrice: Number(order.totalPrice),
    isVerified: order.isVerified,
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt,
    prepStartedAt: order.prepStartedAt,
    readyAt: order.readyAt,
    servedAt: order.servedAt,
    expiresAt: order.expiresAt,
    items: (order.items || []).map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: Number(item.quantity),
      priceAtTime: Number(item.priceAtTime),
      lineTotal: Number(item.lineTotal),
    })),
  }));
}

export async function verifyOrderCode({ code, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    return verifyDemoOrder(code, sessionToken);
  }

  const { data, error } = await supabase.rpc("verify_order_code", {
    p_session_token: sessionToken,
    p_code: code,
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    if (error.message?.toLowerCase().includes("session")) {
      clearAdminSessionToken();
    }
    throw normalizeError(error, "Unable to verify the code.");
  }

  return data;
}

export async function advanceOrderStatus({ orderId, status, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    return advanceDemoOrder(orderId, status, sessionToken);
  }

  const { data, error } = await supabase.rpc("advance_order_status", {
    p_session_token: sessionToken,
    p_order_id: Number(orderId),
    p_status: status,
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to advance the order.");
  }

  return data;
}

export async function cancelOrder({ orderId, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    return cancelDemoOrder(orderId, sessionToken);
  }

  const { data, error } = await supabase.rpc("cancel_order", {
    p_session_token: sessionToken,
    p_order_id: Number(orderId),
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to cancel the order.");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Admin menu management
// ---------------------------------------------------------------------------
export async function listMenuItems(sessionToken = getStoredAdminSessionToken()) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    return getDemoMenuForRestaurant(demoSession.restaurant.id);
  }

  const { data, error } = await supabase.rpc("list_menu_items", { p_session_token: sessionToken });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to load menu items.");
  }

  return (data || []).map((item) => ({
    id: item.id,
    restaurantId: item.restaurantId,
    category: item.category,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    arModelUrl: item.arModelUrl,
    imageUrl: item.imageUrl,
    isAvailable: item.isAvailable,
    displayOrder: item.displayOrder,
  }));
}

export async function createMenuItem({ item, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const menu = readDemoMenu();
    const newItem = {
      id: nextDemoMenuId(),
      restaurantId: demoSession.restaurant.id,
      category: item.category || "Menu",
      name: item.name,
      description: item.description || "",
      price: Number(item.price || 0),
      arModelUrl: item.arModelUrl || "",
      imageUrl: item.imageUrl || "",
      isAvailable: item.isAvailable !== false,
      displayOrder: Number(item.displayOrder || 0),
    };
    menu.push(newItem);
    writeDemoMenu(menu);
    return { id: newItem.id };
  }

  const { data, error } = await supabase.rpc("create_menu_item", {
    p_session_token: sessionToken,
    p_item: item,
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to create the menu item.");
  }

  return data;
}

export async function updateMenuItem({ id, item, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const menu = readDemoMenu();
    const index = menu.findIndex(
      (entry) =>
        Number(entry.id) === Number(id) &&
        Number(entry.restaurantId) === Number(demoSession.restaurant.id),
    );
    if (index === -1) {
      throw new Error("Menu item not found for this restaurant.");
    }
    menu[index] = {
      ...menu[index],
      ...item,
      price: item.price != null ? Number(item.price) : menu[index].price,
      displayOrder: item.displayOrder != null ? Number(item.displayOrder) : menu[index].displayOrder,
    };
    writeDemoMenu(menu);
    return { id: Number(id) };
  }

  const { data, error } = await supabase.rpc("update_menu_item", {
    p_session_token: sessionToken,
    p_id: Number(id),
    p_item: item,
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to update the menu item.");
  }

  return data;
}

export async function setMenuItemAvailability({ id, available, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const menu = readDemoMenu();
    const index = menu.findIndex(
      (entry) =>
        Number(entry.id) === Number(id) &&
        Number(entry.restaurantId) === Number(demoSession.restaurant.id),
    );
    if (index === -1) {
      throw new Error("Menu item not found for this restaurant.");
    }
    menu[index] = { ...menu[index], isAvailable: available };
    writeDemoMenu(menu);
    return { id: Number(id), isAvailable: available };
  }

  const { data, error } = await supabase.rpc("set_menu_item_availability", {
    p_session_token: sessionToken,
    p_id: Number(id),
    p_available: available,
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to update availability.");
  }

  return data;
}

export async function deleteMenuItem({ id, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const menu = readDemoMenu();
    const next = menu.filter(
      (entry) =>
        !(
          Number(entry.id) === Number(id) &&
          Number(entry.restaurantId) === Number(demoSession.restaurant.id)
        ),
    );
    if (next.length === menu.length) {
      throw new Error("Menu item not found for this restaurant.");
    }
    writeDemoMenu(next);
    return { id: Number(id), deleted: true };
  }

  const { data, error } = await supabase.rpc("delete_menu_item", {
    p_session_token: sessionToken,
    p_id: Number(id),
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to delete the menu item.");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Admin table management
// ---------------------------------------------------------------------------
export async function listTables(sessionToken = getStoredAdminSessionToken()) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    return getDemoTablesForRestaurant(demoSession.restaurant.id);
  }

  const { data, error } = await supabase.rpc("list_tables", { p_session_token: sessionToken });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to load tables.");
  }

  return (data || []).map((table) => ({
    id: table.id,
    tableNumber: table.tableNumber,
    label: table.label,
    seats: Number(table.seats),
    qrToken: table.qrToken,
    isActive: table.isActive,
  }));
}

export async function createTable({ table, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const tables = readDemoTables();
    const id = nextDemoTableId();
    const newTable = {
      id,
      restaurantId: demoSession.restaurant.id,
      tableNumber: table.tableNumber,
      label: table.label || "",
      seats: Number(table.seats || 2),
      qrToken: `demo-token-${demoSession.restaurant.id}-${id}-${Math.random().toString(36).slice(2, 8)}`,
      isActive: table.isActive !== false,
    };
    tables.push(newTable);
    writeDemoTables(tables);
    return { id: newTable.id, qrToken: newTable.qrToken };
  }

  const { data, error } = await supabase.rpc("create_table", {
    p_session_token: sessionToken,
    p_table: table,
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to create the table.");
  }

  return data;
}

export async function updateTable({ id, table, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const tables = readDemoTables();
    const index = tables.findIndex(
      (entry) =>
        Number(entry.id) === Number(id) &&
        Number(entry.restaurantId) === Number(demoSession.restaurant.id),
    );
    if (index === -1) {
      throw new Error("Table not found for this restaurant.");
    }
    tables[index] = {
      ...tables[index],
      ...table,
      seats: table.seats != null ? Number(table.seats) : tables[index].seats,
    };
    writeDemoTables(tables);
    return { id: Number(id) };
  }

  const { data, error } = await supabase.rpc("update_table", {
    p_session_token: sessionToken,
    p_id: Number(id),
    p_table: table,
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to update the table.");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Demo: reservations store
// ---------------------------------------------------------------------------
const DEMO_RESERVATIONS_STORAGE_KEY = "mapolos-demo-reservations-v1";
const DEMO_RESERVATIONS_SEQ_KEY = "mapolos-demo-res-seq-v1";

function buildDemoReservationsSeed() {
  const now = new Date();
  const today = (h, m) => { const d = new Date(now); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const tomorrow = (h, m) => { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const yesterday = (h, m) => { const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(h, m, 0, 0); return d.toISOString(); };
  return [
    { id: 1, restaurantId: 1, tableId: 6, tableNumber: "T-06", guestName: "Raza Family", guestPhone: "+92-300-9876543", partySize: 4, reservedAt: today(19, 0), durationMinutes: 90, status: "confirmed", notes: "Window seat preferred", createdAt: yesterday(10, 0) },
    { id: 2, restaurantId: 1, tableId: null, tableNumber: null, guestName: "Ahmed Birthday", guestPhone: "+92-301-8765432", partySize: 6, reservedAt: today(20, 0), durationMinutes: 120, status: "confirmed", notes: "Birthday cake arranged", createdAt: yesterday(14, 30) },
    { id: 3, restaurantId: 1, tableId: 3, tableNumber: "T-03", guestName: "Business Lunch", guestPhone: null, partySize: 2, reservedAt: tomorrow(13, 0), durationMinutes: 60, status: "confirmed", notes: "", createdAt: today(9, 0) },
    { id: 4, restaurantId: 1, tableId: 8, tableNumber: "T-08", guestName: "Ali Family", guestPhone: "+92-302-7654321", partySize: 4, reservedAt: today(19, 30), durationMinutes: 90, status: "seated", notes: "", createdAt: yesterday(16, 0) },
    { id: 5, restaurantId: 2, tableId: null, tableNumber: null, guestName: "Khan Group", guestPhone: "+92-303-6543210", partySize: 3, reservedAt: today(20, 30), durationMinutes: 90, status: "confirmed", notes: "Outdoor seating", createdAt: yesterday(11, 0) },
  ];
}

function readDemoReservations() {
  if (!isBrowser()) return buildDemoReservationsSeed();
  const existing = window.localStorage.getItem(DEMO_RESERVATIONS_STORAGE_KEY);
  if (existing) { try { return JSON.parse(existing); } catch { /* rebuild */ } }
  const seed = buildDemoReservationsSeed();
  window.localStorage.setItem(DEMO_RESERVATIONS_STORAGE_KEY, JSON.stringify(seed));
  window.localStorage.setItem(DEMO_RESERVATIONS_SEQ_KEY, String(Math.max(...seed.map(r => r.id))));
  return seed;
}

function writeDemoReservations(items) {
  if (!isBrowser()) return;
  window.localStorage.setItem(DEMO_RESERVATIONS_STORAGE_KEY, JSON.stringify(items));
  if (items.length) window.localStorage.setItem(DEMO_RESERVATIONS_SEQ_KEY, String(Math.max(...items.map(r => r.id))));
}

function nextDemoReservationId() {
  if (!isBrowser()) return 100;
  const stored = Number(window.localStorage.getItem(DEMO_RESERVATIONS_SEQ_KEY) || 100);
  const next = Number.isFinite(stored) ? stored + 1 : 101;
  window.localStorage.setItem(DEMO_RESERVATIONS_SEQ_KEY, String(next));
  return next;
}

// ---------------------------------------------------------------------------
// Demo: inventory store
// ---------------------------------------------------------------------------
const DEMO_INVENTORY_STORAGE_KEY = "mapolos-demo-inventory-v1";
const DEMO_INVENTORY_SEQ_KEY = "mapolos-demo-inv-seq-v1";

function buildDemoInventorySeed() {
  return [
    { id: 1, restaurantId: 1, name: "All-Purpose Flour", category: "Dry Goods", unit: "kg", quantityOnHand: 45, lowStockThreshold: 10, costPerUnit: 180, supplier: "Al-Ghazali Mills", lastRestockedAt: null, isLow: false },
    { id: 2, restaurantId: 1, name: "Chicken Breast", category: "Proteins", unit: "kg", quantityOnHand: 8, lowStockThreshold: 5, costPerUnit: 750, supplier: "Fresh Direct", lastRestockedAt: null, isLow: false },
    { id: 3, restaurantId: 1, name: "Parmesan", category: "Dairy", unit: "kg", quantityOnHand: 2, lowStockThreshold: 3, costPerUnit: 1200, supplier: "Imported Deli", lastRestockedAt: null, isLow: true },
    { id: 4, restaurantId: 1, name: "Pasta (Fettuccine)", category: "Dry Goods", unit: "kg", quantityOnHand: 12, lowStockThreshold: 5, costPerUnit: 300, supplier: "Al-Ghazali Mills", lastRestockedAt: null, isLow: false },
    { id: 5, restaurantId: 1, name: "Olive Oil", category: "Condiments", unit: "L", quantityOnHand: 6, lowStockThreshold: 2, costPerUnit: 850, supplier: "Mediterranean Imports", lastRestockedAt: null, isLow: false },
    { id: 6, restaurantId: 1, name: "Heavy Cream", category: "Dairy", unit: "L", quantityOnHand: 3, lowStockThreshold: 2, costPerUnit: 450, supplier: "Fresh Direct", lastRestockedAt: null, isLow: false },
    { id: 7, restaurantId: 1, name: "Tarragon (Fresh)", category: "Herbs", unit: "g", quantityOnHand: 120, lowStockThreshold: 50, costPerUnit: 600, supplier: "Green Farms", lastRestockedAt: null, isLow: false },
    { id: 8, restaurantId: 2, name: "Chicken Breast", category: "Proteins", unit: "kg", quantityOnHand: 6, lowStockThreshold: 5, costPerUnit: 750, supplier: "Fresh Direct", lastRestockedAt: null, isLow: false },
    { id: 9, restaurantId: 2, name: "Parmesan", category: "Dairy", unit: "kg", quantityOnHand: 4, lowStockThreshold: 3, costPerUnit: 1200, supplier: "Imported Deli", lastRestockedAt: null, isLow: false },
  ];
}

function readDemoInventory() {
  if (!isBrowser()) return buildDemoInventorySeed();
  const existing = window.localStorage.getItem(DEMO_INVENTORY_STORAGE_KEY);
  if (existing) { try { return JSON.parse(existing); } catch { /* rebuild */ } }
  const seed = buildDemoInventorySeed();
  window.localStorage.setItem(DEMO_INVENTORY_STORAGE_KEY, JSON.stringify(seed));
  window.localStorage.setItem(DEMO_INVENTORY_SEQ_KEY, String(Math.max(...seed.map(i => i.id))));
  return seed;
}

function writeDemoInventory(items) {
  if (!isBrowser()) return;
  window.localStorage.setItem(DEMO_INVENTORY_STORAGE_KEY, JSON.stringify(items));
  if (items.length) window.localStorage.setItem(DEMO_INVENTORY_SEQ_KEY, String(Math.max(...items.map(i => i.id))));
}

function nextDemoInventoryId() {
  if (!isBrowser()) return 100;
  const stored = Number(window.localStorage.getItem(DEMO_INVENTORY_SEQ_KEY) || 100);
  const next = Number.isFinite(stored) ? stored + 1 : 101;
  window.localStorage.setItem(DEMO_INVENTORY_SEQ_KEY, String(next));
  return next;
}

function getDemoInventoryForRestaurant(restaurantId) {
  return readDemoInventory()
    .filter(i => Number(i.restaurantId) === Number(restaurantId))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Demo: staff store
// ---------------------------------------------------------------------------
const DEMO_STAFF_STORAGE_KEY = "mapolos-demo-staff-v1";
const DEMO_STAFF_SEQ_KEY = "mapolos-demo-staff-seq-v1";
const DEMO_SHIFTS_STORAGE_KEY = "mapolos-demo-shifts-v1";
const DEMO_SHIFTS_SEQ_KEY = "mapolos-demo-shifts-seq-v1";

function buildDemoStaffSeed() {
  return [
    { id: 1, restaurantId: 1, name: "Ahmed Malik", role: "head_chef", phone: "+92-300-1234567", hourlyRate: 550, isActive: true, hiredAt: "2023-03-01", activeShiftId: 1, clockedInAt: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString() },
    { id: 2, restaurantId: 1, name: "Sara Khan", role: "server", phone: "+92-301-2345678", hourlyRate: 280, isActive: true, hiredAt: "2023-06-15", activeShiftId: 2, clockedInAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
    { id: 3, restaurantId: 1, name: "Bilal Qureshi", role: "server", phone: "+92-302-3456789", hourlyRate: 280, isActive: true, hiredAt: "2024-01-10", activeShiftId: null, clockedInAt: null },
    { id: 4, restaurantId: 1, name: "Fatima Raza", role: "kitchen_staff", phone: "+92-303-4567890", hourlyRate: 320, isActive: true, hiredAt: "2023-09-20", activeShiftId: 3, clockedInAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString() },
    { id: 5, restaurantId: 1, name: "Omar Sheikh", role: "manager", phone: "+92-304-5678901", hourlyRate: 500, isActive: true, hiredAt: "2022-12-01", activeShiftId: null, clockedInAt: null },
    { id: 6, restaurantId: 2, name: "Zara Ahmed", role: "manager", phone: "+92-305-6789012", hourlyRate: 500, isActive: true, hiredAt: "2023-01-15", activeShiftId: 4, clockedInAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
  ];
}

function buildDemoShiftsSeed() {
  const clockIn = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  const clockOut = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  return [
    { id: 1, staffMemberId: 1, restaurantId: 1, clockIn: clockIn(3.5), clockOut: null },
    { id: 2, staffMemberId: 2, restaurantId: 1, clockIn: clockIn(2), clockOut: null },
    { id: 3, staffMemberId: 4, restaurantId: 1, clockIn: clockIn(4), clockOut: null },
    { id: 4, staffMemberId: 6, restaurantId: 2, clockIn: clockIn(5), clockOut: null },
    { id: 5, staffMemberId: 3, restaurantId: 1, clockIn: clockIn(8), clockOut: clockOut(4) },
  ];
}

function readDemoStaff() {
  if (!isBrowser()) return buildDemoStaffSeed();
  const existing = window.localStorage.getItem(DEMO_STAFF_STORAGE_KEY);
  if (existing) { try { return JSON.parse(existing); } catch { /* rebuild */ } }
  const seed = buildDemoStaffSeed();
  window.localStorage.setItem(DEMO_STAFF_STORAGE_KEY, JSON.stringify(seed));
  window.localStorage.setItem(DEMO_STAFF_SEQ_KEY, String(Math.max(...seed.map(s => s.id))));
  return seed;
}

function writeDemoStaff(items) {
  if (!isBrowser()) return;
  window.localStorage.setItem(DEMO_STAFF_STORAGE_KEY, JSON.stringify(items));
  if (items.length) window.localStorage.setItem(DEMO_STAFF_SEQ_KEY, String(Math.max(...items.map(s => s.id))));
}

function nextDemoStaffId() {
  if (!isBrowser()) return 100;
  const stored = Number(window.localStorage.getItem(DEMO_STAFF_SEQ_KEY) || 100);
  const next = Number.isFinite(stored) ? stored + 1 : 101;
  window.localStorage.setItem(DEMO_STAFF_SEQ_KEY, String(next));
  return next;
}

function readDemoShifts() {
  if (!isBrowser()) return buildDemoShiftsSeed();
  const existing = window.localStorage.getItem(DEMO_SHIFTS_STORAGE_KEY);
  if (existing) { try { return JSON.parse(existing); } catch { /* rebuild */ } }
  const seed = buildDemoShiftsSeed();
  window.localStorage.setItem(DEMO_SHIFTS_STORAGE_KEY, JSON.stringify(seed));
  window.localStorage.setItem(DEMO_SHIFTS_SEQ_KEY, String(Math.max(...seed.map(s => s.id))));
  return seed;
}

function writeDemoShifts(items) {
  if (!isBrowser()) return;
  window.localStorage.setItem(DEMO_SHIFTS_STORAGE_KEY, JSON.stringify(items));
  if (items.length) window.localStorage.setItem(DEMO_SHIFTS_SEQ_KEY, String(Math.max(...items.map(s => s.id))));
}

function nextDemoShiftId() {
  if (!isBrowser()) return 200;
  const stored = Number(window.localStorage.getItem(DEMO_SHIFTS_SEQ_KEY) || 200);
  const next = Number.isFinite(stored) ? stored + 1 : 201;
  window.localStorage.setItem(DEMO_SHIFTS_SEQ_KEY, String(next));
  return next;
}

export async function deleteTable({ id, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const tables = readDemoTables();
    const next = tables.filter(
      (entry) =>
        !(
          Number(entry.id) === Number(id) &&
          Number(entry.restaurantId) === Number(demoSession.restaurant.id)
        ),
    );
    if (next.length === tables.length) {
      throw new Error("Table not found for this restaurant.");
    }
    writeDemoTables(next);
    return { id: Number(id), deleted: true };
  }

  const { data, error } = await supabase.rpc("delete_table", {
    p_session_token: sessionToken,
    p_id: Number(id),
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }
    throw normalizeError(error, "Unable to delete the table.");
  }

  return data;
}

// ---------------------------------------------------------------------------
// POS: staff-initiated order (auto-confirmed, no QR)
// ---------------------------------------------------------------------------
export async function createPosOrder({ order, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const demoOrder = createDemoOrderRecord({
      restaurantId: demoSession.restaurant.id,
      tableId: order.tableId || null,
      tableNumber: order.tableNumber || "",
      customerName: order.customerName || "",
      specialRequest: order.specialRequest || "",
      items: order.items || [],
    });
    const confirmed = {
      ...demoOrder,
      status: "confirmed",
      isVerified: true,
      confirmedAt: new Date().toISOString(),
    };
    upsertDemoOrder(confirmed);
    // update table status in demo
    if (order.tableId) {
      const tables = readDemoTables();
      const idx = tables.findIndex(t => Number(t.id) === Number(order.tableId));
      if (idx !== -1) { tables[idx] = { ...tables[idx], status: "occupied" }; writeDemoTables(tables); }
    }
    return { orderId: confirmed.orderId, status: "confirmed", totalPrice: Number(confirmed.totalPrice) };
  }

  const { data, error } = await supabase.rpc("create_pos_order", {
    p_session_token: sessionToken,
    p_order: order,
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to create POS order.");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Table status
// ---------------------------------------------------------------------------
export async function updateTableStatus({ tableId, status, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const tables = readDemoTables();
    const idx = tables.findIndex(
      t => Number(t.id) === Number(tableId) && Number(t.restaurantId) === Number(demoSession.restaurant.id)
    );
    if (idx === -1) throw new Error("Table not found.");
    tables[idx] = { ...tables[idx], status };
    writeDemoTables(tables);
    return { id: Number(tableId), status };
  }

  const { data, error } = await supabase.rpc("update_table_status", {
    p_session_token: sessionToken,
    p_table_id: Number(tableId),
    p_status: status,
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to update table status.");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------
export async function listReservations({ from, to, sessionToken = getStoredAdminSessionToken() } = {}) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const rid = demoSession.restaurant.id;
    const fromMs = from ? new Date(from).getTime() : Date.now() - 24 * 3600 * 1000;
    const toMs = to ? new Date(to).getTime() : Date.now() + 7 * 24 * 3600 * 1000;
    return readDemoReservations()
      .filter(r => Number(r.restaurantId) === rid)
      .filter(r => { const t = new Date(r.reservedAt).getTime(); return t >= fromMs && t <= toMs; })
      .sort((a, b) => new Date(a.reservedAt) - new Date(b.reservedAt));
  }

  const { data, error } = await supabase.rpc("list_reservations", {
    p_session_token: sessionToken,
    p_from: from || null,
    p_to: to || null,
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to load reservations.");
  }

  return (data || []).map(r => ({
    id: r.id, tableId: r.tableId, tableNumber: r.tableNumber,
    guestName: r.guestName, guestPhone: r.guestPhone, partySize: Number(r.partySize),
    reservedAt: r.reservedAt, durationMinutes: Number(r.durationMinutes),
    status: r.status, notes: r.notes, createdAt: r.createdAt,
  }));
}

export async function createReservation({ reservation, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const list = readDemoReservations();
    const tables = getDemoTablesForRestaurant(demoSession.restaurant.id);
    const table = reservation.tableId ? tables.find(t => Number(t.id) === Number(reservation.tableId)) : null;
    const newItem = {
      id: nextDemoReservationId(),
      restaurantId: demoSession.restaurant.id,
      tableId: reservation.tableId || null,
      tableNumber: table?.tableNumber || null,
      guestName: reservation.guestName,
      guestPhone: reservation.guestPhone || null,
      partySize: Number(reservation.partySize || 2),
      reservedAt: reservation.reservedAt,
      durationMinutes: Number(reservation.durationMinutes || 90),
      status: reservation.status || "confirmed",
      notes: reservation.notes || "",
      createdAt: new Date().toISOString(),
    };
    list.push(newItem);
    writeDemoReservations(list);
    return { id: newItem.id };
  }

  const { data, error } = await supabase.rpc("create_reservation", {
    p_session_token: sessionToken,
    p_data: reservation,
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to create reservation.");
  }

  return data;
}

export async function updateReservationStatus({ id, status, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const list = readDemoReservations();
    const idx = list.findIndex(r => Number(r.id) === Number(id) && Number(r.restaurantId) === Number(demoSession.restaurant.id));
    if (idx === -1) throw new Error("Reservation not found.");
    list[idx] = { ...list[idx], status };
    writeDemoReservations(list);
    return { id: Number(id), status };
  }

  const { data, error } = await supabase.rpc("update_reservation_status", {
    p_session_token: sessionToken,
    p_id: Number(id),
    p_status: status,
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to update reservation.");
  }

  return data;
}

export async function deleteReservation({ id, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const list = readDemoReservations();
    const next = list.filter(r => !(Number(r.id) === Number(id) && Number(r.restaurantId) === Number(demoSession.restaurant.id)));
    if (next.length === list.length) throw new Error("Reservation not found.");
    writeDemoReservations(next);
    return { id: Number(id), deleted: true };
  }

  const { data, error } = await supabase.rpc("delete_reservation", {
    p_session_token: sessionToken,
    p_id: Number(id),
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to delete reservation.");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export async function listInventory(sessionToken = getStoredAdminSessionToken()) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    return getDemoInventoryForRestaurant(demoSession.restaurant.id);
  }

  const { data, error } = await supabase.rpc("list_inventory", { p_session_token: sessionToken });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to load inventory.");
  }

  return (data || []).map(i => ({
    id: i.id, name: i.name, category: i.category, unit: i.unit,
    quantityOnHand: Number(i.quantityOnHand), lowStockThreshold: Number(i.lowStockThreshold),
    costPerUnit: Number(i.costPerUnit), supplier: i.supplier,
    lastRestockedAt: i.lastRestockedAt, isLow: i.isLow,
  }));
}

export async function createInventoryItem({ item, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const list = readDemoInventory();
    const newItem = {
      id: nextDemoInventoryId(),
      restaurantId: demoSession.restaurant.id,
      name: item.name,
      category: item.category || "General",
      unit: item.unit || "pcs",
      quantityOnHand: Number(item.quantityOnHand || 0),
      lowStockThreshold: Number(item.lowStockThreshold || 10),
      costPerUnit: Number(item.costPerUnit || 0),
      supplier: item.supplier || null,
      lastRestockedAt: null,
      isLow: Number(item.quantityOnHand || 0) <= Number(item.lowStockThreshold || 10),
    };
    list.push(newItem);
    writeDemoInventory(list);
    return { id: newItem.id };
  }

  const { data, error } = await supabase.rpc("create_inventory_item", {
    p_session_token: sessionToken,
    p_item: item,
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to create inventory item.");
  }

  return data;
}

export async function updateInventoryItem({ id, item, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const list = readDemoInventory();
    const idx = list.findIndex(i => Number(i.id) === Number(id) && Number(i.restaurantId) === Number(demoSession.restaurant.id));
    if (idx === -1) throw new Error("Item not found.");
    const updated = { ...list[idx], ...item, quantityOnHand: Number(item.quantityOnHand ?? list[idx].quantityOnHand) };
    updated.isLow = updated.quantityOnHand <= updated.lowStockThreshold;
    list[idx] = updated;
    writeDemoInventory(list);
    return { id: Number(id) };
  }

  const { data, error } = await supabase.rpc("update_inventory_item", {
    p_session_token: sessionToken,
    p_id: Number(id),
    p_item: item,
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to update inventory item.");
  }

  return data;
}

export async function adjustInventoryStock({ id, delta, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const list = readDemoInventory();
    const idx = list.findIndex(i => Number(i.id) === Number(id) && Number(i.restaurantId) === Number(demoSession.restaurant.id));
    if (idx === -1) throw new Error("Item not found.");
    const newQty = Math.max(0, Number(list[idx].quantityOnHand) + Number(delta));
    list[idx] = {
      ...list[idx],
      quantityOnHand: newQty,
      isLow: newQty <= list[idx].lowStockThreshold,
      lastRestockedAt: delta > 0 ? new Date().toISOString() : list[idx].lastRestockedAt,
    };
    writeDemoInventory(list);
    return { id: Number(id), quantityOnHand: newQty };
  }

  const { data, error } = await supabase.rpc("adjust_inventory_stock", {
    p_session_token: sessionToken,
    p_id: Number(id),
    p_delta: Number(delta),
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to adjust stock.");
  }

  return data;
}

export async function deleteInventoryItem({ id, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const list = readDemoInventory();
    const next = list.filter(i => !(Number(i.id) === Number(id) && Number(i.restaurantId) === Number(demoSession.restaurant.id)));
    if (next.length === list.length) throw new Error("Item not found.");
    writeDemoInventory(next);
    return { id: Number(id), deleted: true };
  }

  const { data, error } = await supabase.rpc("delete_inventory_item", {
    p_session_token: sessionToken,
    p_id: Number(id),
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to delete inventory item.");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
export async function listStaff(sessionToken = getStoredAdminSessionToken()) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    return readDemoStaff().filter(s => Number(s.restaurantId) === Number(demoSession.restaurant.id));
  }

  const { data, error } = await supabase.rpc("list_staff", { p_session_token: sessionToken });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to load staff.");
  }

  return (data || []).map(s => ({
    id: s.id, name: s.name, role: s.role, phone: s.phone,
    hourlyRate: s.hourlyRate ? Number(s.hourlyRate) : null,
    isActive: s.isActive, hiredAt: s.hiredAt,
    activeShiftId: s.activeShiftId || null,
    clockedInAt: s.clockedInAt || null,
  }));
}

export async function createStaffMember({ member, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const list = readDemoStaff();
    const newMember = {
      id: nextDemoStaffId(),
      restaurantId: demoSession.restaurant.id,
      name: member.name,
      role: member.role || "server",
      phone: member.phone || null,
      hourlyRate: member.hourlyRate ? Number(member.hourlyRate) : null,
      isActive: member.isActive !== false,
      hiredAt: member.hiredAt || new Date().toISOString().slice(0, 10),
      activeShiftId: null,
      clockedInAt: null,
    };
    list.push(newMember);
    writeDemoStaff(list);
    return { id: newMember.id };
  }

  const { data, error } = await supabase.rpc("create_staff_member", {
    p_session_token: sessionToken,
    p_member: member,
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to create staff member.");
  }

  return data;
}

export async function updateStaffMember({ id, member, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const list = readDemoStaff();
    const idx = list.findIndex(s => Number(s.id) === Number(id) && Number(s.restaurantId) === Number(demoSession.restaurant.id));
    if (idx === -1) throw new Error("Staff member not found.");
    list[idx] = { ...list[idx], ...member };
    writeDemoStaff(list);
    return { id: Number(id) };
  }

  const { data, error } = await supabase.rpc("update_staff_member", {
    p_session_token: sessionToken,
    p_id: Number(id),
    p_member: member,
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to update staff member.");
  }

  return data;
}

export async function deleteStaffMember({ id, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const list = readDemoStaff();
    const next = list.filter(s => !(Number(s.id) === Number(id) && Number(s.restaurantId) === Number(demoSession.restaurant.id)));
    if (next.length === list.length) throw new Error("Staff member not found.");
    writeDemoStaff(next);
    return { id: Number(id), deleted: true };
  }

  const { data, error } = await supabase.rpc("delete_staff_member", {
    p_session_token: sessionToken,
    p_id: Number(id),
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to delete staff member.");
  }

  return data;
}

export async function clockInStaff({ staffId, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const staff = readDemoStaff();
    const shifts = readDemoShifts();
    const memberIdx = staff.findIndex(s => Number(s.id) === Number(staffId) && Number(s.restaurantId) === Number(demoSession.restaurant.id));
    if (memberIdx === -1) throw new Error("Staff member not found.");
    if (staff[memberIdx].activeShiftId) throw new Error("Already clocked in.");
    const shiftId = nextDemoShiftId();
    const clockIn = new Date().toISOString();
    shifts.push({ id: shiftId, staffMemberId: Number(staffId), restaurantId: demoSession.restaurant.id, clockIn, clockOut: null });
    staff[memberIdx] = { ...staff[memberIdx], activeShiftId: shiftId, clockedInAt: clockIn };
    writeDemoShifts(shifts);
    writeDemoStaff(staff);
    return { shiftId, clockIn };
  }

  const { data, error } = await supabase.rpc("clock_in_staff", {
    p_session_token: sessionToken,
    p_staff_id: Number(staffId),
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to clock in.");
  }

  return data;
}

export async function clockOutStaff({ shiftId, staffId, sessionToken = getStoredAdminSessionToken() }) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const shifts = readDemoShifts();
    const staff = readDemoStaff();
    const shiftIdx = shifts.findIndex(s => Number(s.id) === Number(shiftId));
    if (shiftIdx === -1 || shifts[shiftIdx].clockOut) throw new Error("Shift not found or already closed.");
    const clockOut = new Date().toISOString();
    shifts[shiftIdx] = { ...shifts[shiftIdx], clockOut };
    const memberIdx = staff.findIndex(s => Number(s.id) === Number(staffId));
    if (memberIdx !== -1) staff[memberIdx] = { ...staff[memberIdx], activeShiftId: null, clockedInAt: null };
    writeDemoShifts(shifts);
    writeDemoStaff(staff);
    return { shiftId: Number(shiftId), clockOut };
  }

  const { data, error } = await supabase.rpc("clock_out_staff", {
    p_session_token: sessionToken,
    p_shift_id: Number(shiftId),
  });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to clock out.");
  }

  return data;
}

export async function getActiveShifts(sessionToken = getStoredAdminSessionToken()) {
  const demoSession = getDemoSession(sessionToken);
  if (demoSession) {
    const rid = demoSession.restaurant.id;
    const shifts = readDemoShifts().filter(s => Number(s.restaurantId) === rid);
    const staff = readDemoStaff().filter(s => Number(s.restaurantId) === rid);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return shifts
      .filter(s => new Date(s.clockIn).getTime() >= today.getTime())
      .map(s => {
        const member = staff.find(m => Number(m.id) === Number(s.staffMemberId));
        const end = s.clockOut ? new Date(s.clockOut) : new Date();
        const hours = (end.getTime() - new Date(s.clockIn).getTime()) / 3600000;
        return {
          shiftId: s.id, staffId: s.staffMemberId,
          staffName: member?.name || "Unknown", role: member?.role || "unknown",
          clockIn: s.clockIn, clockOut: s.clockOut || null,
          hoursWorked: Math.round(hours * 100) / 100,
        };
      })
      .sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn));
  }

  const { data, error } = await supabase.rpc("get_active_shifts", { p_session_token: sessionToken });

  if (error) {
    if (isMissingRpc(error)) throw migrationRequiredError();
    throw normalizeError(error, "Unable to load shifts.");
  }

  return (data || []).map(s => ({
    shiftId: s.shiftId, staffId: s.staffId, staffName: s.staffName, role: s.role,
    clockIn: s.clockIn, clockOut: s.clockOut, hoursWorked: Number(s.hoursWorked),
  }));
}
