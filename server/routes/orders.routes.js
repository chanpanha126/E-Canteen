const express = require('express');
const {
  getOrders,
  saveOrders,
  getNextOrderIdentifiers,
} = require('../services/store');

const router = express.Router();

const ALLOWED_STATUSES = ['preparing', 'ready', 'completed'];

/**
 * Calculates summary statistics (revenue, order status counts, top items)
 * for the Staff Dashboard.
 */
function computeAnalytics(orders) {
  let totalRevenue = 0;
  let preparingCount = 0;
  let readyCount = 0;
  let completedCount = 0;
  const itemCounts = {};

  for (const order of orders) {
    totalRevenue += Number(order.totalAmount || 0);

    if (order.status === 'preparing') preparingCount += 1;
    else if (order.status === 'ready') readyCount += 1;
    else if (order.status === 'completed') completedCount += 1;

    for (const item of order.items || []) {
      const prev = itemCounts[item.name] || 0;
      itemCounts[item.name] = prev + Number(item.qty || 0);
    }
  }

  const topItems = Object.entries(itemCounts)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return {
    totalOrders: orders.length,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    preparingCount,
    readyCount,
    completedCount,
    topItems,
  };
}

// GET /api/orders — returns all orders (newest first) + analytics summary
router.get('/', (req, res) => {
  const orders = getOrders();
  const sorted = [...orders].sort((a, b) => b.orderId - a.orderId);
  return res.json({
    orders: sorted,
    analytics: computeAnalytics(orders),
  });
});

// POST /api/orders — validates cart items, creates order, and assigns queueNumber
router.post('/', (req, res) => {
  const { table, items, paymentMd5 = null, customerNote = '' } = req.body || {};

  const parsedTable = Number(table);
  if (!Number.isInteger(parsedTable) || parsedTable <= 0) {
    return res.status(400).json({ error: 'A valid positive integer `table` is required.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must include at least one item.' });
  }

  const normalizedItems = [];
  for (const item of items) {
    if (
      !item ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      typeof item.qty !== 'number' ||
      item.qty <= 0 ||
      typeof item.price !== 'number' ||
      item.price < 0
    ) {
      return res.status(400).json({
        error: 'Each item requires a valid `name`, positive `qty`, and non-negative `price`.',
      });
    }
    normalizedItems.push({
      name: item.name.trim(),
      qty: Math.round(item.qty),
      price: Number(item.price),
    });
  }

  let totalAmount = 0;
  for (const item of normalizedItems) {
    totalAmount += item.price * item.qty;
  }
  totalAmount = Number(totalAmount.toFixed(2));

  const orders = getOrders();
  const { orderId, queueNumber } = getNextOrderIdentifiers(orders);

  const newOrder = {
    orderId,
    table: parsedTable,
    queueNumber,
    items: normalizedItems,
    totalAmount,
    paymentMd5,
    customerNote: typeof customerNote === 'string' ? customerNote.trim() : '',
    status: 'preparing',
    createdAt: new Date().toISOString(),
  };

  orders.push(newOrder);
  saveOrders(orders);

  return res.status(201).json({
    orderId: newOrder.orderId,
    table: newOrder.table,
    queueNumber: newOrder.queueNumber,
    items: newOrder.items,
    totalAmount: newOrder.totalAmount,
    status: newOrder.status,
    createdAt: newOrder.createdAt,
  });
});

// GET /api/orders/:orderId/status — lightweight polling endpoint for customer screen
router.get('/:orderId/status', (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'Invalid orderId.' });
  }

  const orders = getOrders();
  const order = orders.find((o) => o.orderId === orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  return res.json({
    orderId: order.orderId,
    queueNumber: order.queueNumber,
    status: order.status,
  });
});

// PATCH /api/orders/:orderId/status — updates order status ("preparing" | "ready" | "completed")
router.patch('/:orderId/status', (req, res) => {
  const orderId = Number(req.params.orderId);
  const { status } = req.body || {};

  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'Invalid orderId.' });
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status. Allowed values: preparing, ready, completed.',
    });
  }

  const orders = getOrders();
  const order = orders.find((o) => o.orderId === orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  order.status = status;
  saveOrders(orders);

  return res.json({
    orderId: order.orderId,
    queueNumber: order.queueNumber,
    status: order.status,
  });
});

// PUT /api/orders/:orderId — updates an order's status and/or customerNote
router.put('/:orderId', (req, res) => {
  const orderId = Number(req.params.orderId);
  const { status, customerNote } = req.body || {};

  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'Invalid orderId.' });
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status. Allowed values: preparing, ready, completed.',
    });
  }

  const orders = getOrders();
  const order = orders.find((o) => o.orderId === orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  if (status !== undefined) order.status = status;
  if (typeof customerNote === 'string') order.customerNote = customerNote.trim();

  saveOrders(orders);
  return res.json({ order });
});

// DELETE /api/orders/:orderId — cancels and removes an order
router.delete('/:orderId', (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'Invalid orderId.' });
  }

  const orders = getOrders();
  const index = orders.findIndex((o) => o.orderId === orderId);

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const [deletedOrder] = orders.splice(index, 1);
  saveOrders(orders);

  return res.json({ deleted: true, orderId: deletedOrder.orderId });
});

module.exports = router;
