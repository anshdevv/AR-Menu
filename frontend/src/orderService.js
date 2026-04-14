import { supabase } from "./supabase";

export const DEFAULT_RESTAURANT_ID = 1;

const ADMIN_SESSION_STORAGE_KEY = "mapolos-admin-session";
const DEMO_ORDERS_STORAGE_KEY = "mapolos-demo-orders-v1";
const DEMO_ORDER_SEQUENCE_KEY = "mapolos-demo-order-seq-v1";
const DEMO_SESSION_PREFIX = "demo-session";
const SCHEMA_MIGRATION_HINT =
  "Run the Supabase restaurant ordering SQL migration to enable secure orders and manager tools.";

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

const DEMO_MENU_ITEMS = [
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
  {
    id: 1,
    email: "manager@mapolos.com",
    password: "Mapolos@123",
    restaurantId: 1,
    role: "owner",
  },
  {
    id: 2,
    email: "garden@mapolos.com",
    password: "Garden@123",
    restaurantId: 2,
    role: "manager",
  },
];

function normalizeError(error, fallbackMessage) {
  if (error?.message) {
    return new Error(error.message);
  }

  return new Error(fallbackMessage);
}

function isMissingRpc(error) {
  const message = error?.message || "";
  return message.includes("schema cache") || message.includes("Could not find the function");
}

function migrationRequiredError() {
  return new Error(SCHEMA_MIGRATION_HINT);
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

function getMenuItemById(menuItemId) {
  return DEMO_MENU_ITEMS.find((item) => Number(item.id) === Number(menuItemId));
}

function getDemoAdminByEmail(email) {
  return DEMO_ADMINS.find((admin) => admin.email.toLowerCase() === String(email || "").trim().toLowerCase());
}

function isBrowser() {
  return typeof window !== "undefined";
}

function createDemoSessionToken(adminId) {
  return `${DEMO_SESSION_PREFIX}:${adminId}`;
}

function isDemoSessionToken(token) {
  return String(token || "").startsWith(`${DEMO_SESSION_PREFIX}:`);
}

function buildDemoAdminSession(admin) {
  const restaurant = getRestaurantById(admin.restaurantId);

  return {
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description,
      location: restaurant.location,
      sampleTable: restaurant.sampleTable,
    },
  };
}

function demoDate(daysAgo, minutesAgo = 0) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - minutesAgo * 60 * 1000).toISOString();
}

function buildDemoSeedOrders() {
  return [
    {
      orderId: 7101,
      verificationCode: "483921",
      restaurantId: 1,
      customerName: "Ayesha",
      tableNumber: "T-12",
      specialRequest: "Extra cutlery",
      status: "confirmed",
      isVerified: true,
      totalPrice: 3180,
      createdAt: demoDate(0, 26),
      expiresAt: demoDate(0, 16),
      verifiedAt: demoDate(0, 22),
      items: [
        {
          menuItemId: 1,
          name: "Chicken Alfredo",
          quantity: 1,
          priceAtTime: 1690,
          lineTotal: 1690,
        },
        {
          menuItemId: 2,
          name: "Tarragon Chicken",
          quantity: 1,
          priceAtTime: 1490,
          lineTotal: 1490,
        },
      ],
    },
    {
      orderId: 7102,
      verificationCode: "275644",
      restaurantId: 1,
      customerName: "Bilal",
      tableNumber: "T-09",
      specialRequest: "",
      status: "pending_verification",
      isVerified: false,
      totalPrice: 1690,
      createdAt: demoDate(0, 8),
      expiresAt: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
      verifiedAt: null,
      items: [
        {
          menuItemId: 1,
          name: "Chicken Alfredo",
          quantity: 1,
          priceAtTime: 1690,
          lineTotal: 1690,
        },
      ],
    },
    {
      orderId: 7201,
      verificationCode: "618205",
      restaurantId: 2,
      customerName: "Hina",
      tableNumber: "G-04",
      specialRequest: "No pepper",
      status: "confirmed",
      isVerified: true,
      totalPrice: 1490,
      createdAt: demoDate(1, 34),
      expiresAt: demoDate(1, 24),
      verifiedAt: demoDate(1, 29),
      items: [
        {
          menuItemId: 4,
          name: "Tarragon Chicken",
          quantity: 1,
          priceAtTime: 1490,
          lineTotal: 1490,
        },
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
      // Fall through to rebuild seed state.
    }
  }

  const seedOrders = buildDemoSeedOrders();
  window.localStorage.setItem(DEMO_ORDERS_STORAGE_KEY, JSON.stringify(seedOrders));
  window.localStorage.setItem(DEMO_ORDER_SEQUENCE_KEY, String(Math.max(...seedOrders.map((order) => order.orderId))));
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

function createDemoOrderRecord({ restaurantId, tableNumber, customerName, specialRequest, items }) {
  const orderId = nextDemoOrderId();
  const createdAt = new Date().toISOString();
  const verificationCode = generateVerificationCode();
  const orderItems = buildOrderItems(items);
  const totalPrice = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    orderId,
    verificationCode,
    restaurantId: Number(restaurantId),
    customerName: customerName || "",
    tableNumber: tableNumber || "",
    specialRequest: specialRequest || "",
    status: "pending_verification",
    isVerified: false,
    totalPrice,
    createdAt,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    verifiedAt: null,
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

function buildDemoAnalytics(restaurantId) {
  const orders = getDemoOrdersForRestaurant(restaurantId);
  const today = startOfToday().getTime();
  const totalOrders = orders.length;
  const ordersToday = orders.filter((order) => new Date(order.createdAt).getTime() >= today);
  const verifiedOrders = orders.filter((order) => order.isVerified);
  const revenueToday = ordersToday
    .filter((order) => order.isVerified)
    .reduce((sum, order) => sum + Number(order.totalPrice || 0), 0);
  const avgOrderValue =
    totalOrders > 0
      ? orders.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0) / totalOrders
      : 0;
  const verificationRate = totalOrders > 0 ? (verifiedOrders.length / totalOrders) * 100 : 0;

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

  const itemMap = new Map();

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const existing = itemMap.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
      existing.quantity += Number(item.quantity || 0);
      existing.revenue += Number(item.lineTotal || 0);
      itemMap.set(item.name, existing);
    });
  });

  const topItems = Array.from(itemMap.values())
    .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
    .slice(0, 5);

  return {
    metrics: {
      ordersToday: ordersToday.length,
      revenueToday,
      pendingVerification: orders.filter((order) => order.status === "pending_verification").length,
      avgOrderValue,
      verificationRate: Number(verificationRate.toFixed(1)),
    },
    dailyRevenue,
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
  const session = getDemoSession(sessionToken);

  if (!session) {
    throw new Error("Please sign in to continue.");
  }

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

  if (matchedOrder.isVerified || matchedOrder.status === "confirmed") {
    throw new Error("This order is already verified.");
  }

  if (new Date(matchedOrder.expiresAt).getTime() <= Date.now()) {
    orders[matchedIndex] = {
      ...matchedOrder,
      status: "expired",
      isVerified: false,
    };
    writeDemoOrders(orders);
    throw new Error("This verification code has expired.");
  }

  const verifiedAt = new Date().toISOString();
  orders[matchedIndex] = {
    ...matchedOrder,
    status: "confirmed",
    isVerified: true,
    verifiedAt,
  };
  writeDemoOrders(orders);

  return {
    orderId: matchedOrder.orderId,
    status: "confirmed",
    verifiedAt,
  };
}

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

export async function getRestaurantCatalog(restaurantId) {
  const [restaurantResult, menuResult] = await Promise.all([
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
  ]);

  const fallbackRestaurant = getRestaurantById(restaurantId);
  const fallbackMenuItems = DEMO_MENU_ITEMS.filter(
    (item) => Number(item.restaurantId) === Number(restaurantId),
  );

  if ((restaurantResult.error || !restaurantResult.data) && fallbackRestaurant) {
    return {
      restaurant: fallbackRestaurant,
      menuItems: fallbackMenuItems,
    };
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

export async function createOrder({ restaurantId, tableNumber, customerName, specialRequest, items }) {
  const payload = items.map((item) => ({
    menuItemId: item.menuItemId,
    quantity: item.quantity,
  }));

  const { data, error } = await supabase.rpc("create_order", {
    p_restaurant_id: Number(restaurantId),
    p_table_number: tableNumber || null,
    p_customer_name: customerName || null,
    p_special_request: specialRequest || null,
    p_items: payload,
  });

  if (error) {
    const demoOrder = createDemoOrderRecord({
      restaurantId,
      tableNumber,
      customerName,
      specialRequest,
      items,
    });

    upsertDemoOrder(demoOrder);

    if (!isMissingRpc(error)) {
      return {
        orderId: demoOrder.orderId,
        verificationCode: demoOrder.verificationCode,
        expiresAt: demoOrder.expiresAt,
        status: demoOrder.status,
        totalPrice: Number(demoOrder.totalPrice),
      };
    }

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

  await supabase.rpc("admin_sign_out", {
    p_session_token: sessionToken,
  });

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

  const { data, error } = await supabase.rpc("get_admin_session", {
    p_session_token: sessionToken,
  });

  if (error) {
    if (isMissingRpc(error)) {
      throw migrationRequiredError();
    }

    clearAdminSessionToken();
    throw normalizeError(error, "Unable to validate the admin session.");
  }

  return data;
}

export async function getAdminAnalytics(sessionToken = getStoredAdminSessionToken()) {
  const demoSession = getDemoSession(sessionToken);

  if (demoSession) {
    return buildDemoAnalytics(demoSession.restaurant.id);
  }

  const { data, error } = await supabase.rpc("get_admin_analytics", {
    p_session_token: sessionToken,
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
    metrics: {
      ordersToday: Number(data.metrics.ordersToday || 0),
      revenueToday: Number(data.metrics.revenueToday || 0),
      pendingVerification: Number(data.metrics.pendingVerification || 0),
      avgOrderValue: Number(data.metrics.avgOrderValue || 0),
      verificationRate: Number(data.metrics.verificationRate || 0),
    },
    dailyRevenue: (data.dailyRevenue || []).map((item) => ({
      label: item.label,
      date: item.date,
      revenue: Number(item.revenue || 0),
      orders: Number(item.orders || 0),
    })),
    topItems: (data.topItems || []).map((item) => ({
      name: item.name,
      quantity: Number(item.quantity || 0),
      revenue: Number(item.revenue || 0),
    })),
  };
}

export async function getAdminOrders(sessionToken = getStoredAdminSessionToken()) {
  const demoSession = getDemoSession(sessionToken);

  if (demoSession) {
    return buildDemoOrdersPayload(demoSession.restaurant.id);
  }

  const { data, error } = await supabase.rpc("get_admin_orders", {
    p_session_token: sessionToken,
  });

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
