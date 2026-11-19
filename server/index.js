require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const menuRoutes = require('./routes/menu.routes');
const khqrRoutes = require('./routes/khqr.routes');
const ordersRoutes = require('./routes/orders.routes');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

// Serve static frontend files (HTML5 + Tailwind CDN + Vanilla JS)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/menu', menuRoutes);
app.use('/api/payments/khqr', khqrRoutes);
app.use('/api/orders', ordersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'AUPP E-Canteen API' });
});

app.listen(PORT, () => {
  console.log(`\nE-Canteen Server running at http://localhost:${PORT}`);
  console.log(`Customer QR Menu (Table 7): http://localhost:${PORT}/?table=7`);
  console.log(`Canteen Staff & Demo Panel: http://localhost:${PORT}/staff.html\n`);
});
