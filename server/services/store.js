const fs = require('fs');
const path = require('path');

// File paths for our JSON "database" files
const MENU_PATH = path.join(__dirname, '../data/menu.json');
const ORDERS_PATH = path.join(__dirname, '../data/orders.json');

/**
 * Reads a JSON file from disk and parses it into a JS array/object.
 * Returns `fallback` if the file does not exist or is empty.
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
 * Converts JS data into pretty-formatted JSON text and saves it to disk.
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
 * Generates the next orderId (101, 102, ...) and queueNumber ("A-001", "A-002", ...).
 */
function getNextOrderIdentifiers(existingOrders) {
  let maxOrderId = 100;
  for (const order of existingOrders) {
    if (order.orderId > maxOrderId) {
      maxOrderId = order.orderId;
    }
  }

  const nextOrderId = maxOrderId + 1;
  const nextNumber = String(existingOrders.length + 1).padStart(3, '0');
  const queueNumber = `A-${nextNumber}`;

  return { orderId: nextOrderId, queueNumber };
}

module.exports = {
  getMenuItems,
  saveMenuItems,
  getOrders,
  saveOrders,
  getNextOrderIdentifiers,
};
