const fs = require('fs');
const path = require('path');

const MENU_PATH = path.join(__dirname, '../data/menu.json');
const ORDERS_PATH = path.join(__dirname, '../data/orders.json');

/**
 * Safely reads and parses a JSON file, returning fallback if missing or empty.
 */
function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Failed to read JSON at ${filePath}:`, err.message);
    return fallback;
  }
}

/**
 * Safely writes data formatted as pretty JSON to disk.
 */
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getMenuItems() {
  return readJson(MENU_PATH, []);
}

function saveMenuItems(items) {
  writeJson(MENU_PATH, items);
}

function getOrders() {
  return readJson(ORDERS_PATH, []);
}

function saveOrders(orders) {
  writeJson(ORDERS_PATH, orders);
}

/**
 * Generates the next sequential orderId (starting at 101) and queueNumber ("A-001", "A-002", ...).
 */
function getNextOrderIdentifiers(existingOrders) {
  const maxOrderId = existingOrders.reduce(
    (max, order) => (order.orderId > max ? order.orderId : max),
    100
  );
  const nextOrderId = maxOrderId + 1;
  const sequenceIndex = existingOrders.length + 1;
  const queueNumber = `A-${String(sequenceIndex).padStart(3, '0')}`;

  return { orderId: nextOrderId, queueNumber };
}

module.exports = {
  getMenuItems,
  saveMenuItems,
  getOrders,
  saveOrders,
  getNextOrderIdentifiers,
};
