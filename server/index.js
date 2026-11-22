// Load variables from .env (PORT, BAKONG_ACCOUNT_ID, BAKONG_DEV_TOKEN, etc.)
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const menuRoutes = require('./routes/menu.routes');
const khqrRoutes = require('./routes/khqr.routes');
const ordersRoutes = require('./routes/orders.routes');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Allow cross-origin requests and parse incoming JSON request bodies
app.use(cors());
app.use(express.json());

// Serve static frontend files (HTML, Tailwind CSS, Vanilla JS) from public/
app.use(express.static(path.join(__dirname, '../public')));

// Mount our in-house REST API routes
app.use('/api/menu', menuRoutes);
app.use('/api/payments/khqr', khqrRoutes);
app.use('/api/orders', ordersRoutes);

// Simple health check endpoint to confirm the server is running
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'AUPP E-Canteen API' });
});

// Start listening on port 3000
app.listen(PORT, () => {
  console.log(`\nE-Canteen Server running at http://localhost:${PORT}`);
  console.log(`Customer QR Menu (Table 7): http://localhost:${PORT}/?table=7`);
  console.log(`Canteen Staff & Demo Panel: http://localhost:${PORT}/staff.html\n`);
});
