const express = require('express');
const { generateKhqr, verifyTransactionByMd5 } = require('../services/bakongService');

const router = express.Router();

// POST /api/payments/khqr/generate — creates a real KHQR image for the cart total
router.post('/generate', async (req, res) => {
  try {
    const { amount, currency = 'USD' } = req.body || {};

    if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid positive `amount` is required.' });
    }

    const qrPayload = await generateKhqr({ amount, currency });
    return res.json(qrPayload);
  } catch (err) {
    console.error('KHQR generate error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to generate KHQR code.' });
  }
});

// POST /api/payments/khqr/verify — checks if the Bakong payment MD5 is paid
router.post('/verify', async (req, res) => {
  try {
    const { md5, amount, currency = 'USD', simulate = false } = req.body || {};

    if (!md5 || typeof md5 !== 'string') {
      return res.status(400).json({ error: 'Valid `md5` string is required.' });
    }

    const result = await verifyTransactionByMd5({
      md5,
      amount,
      currency,
      forceSimulate: Boolean(simulate),
    });

    return res.json(result);
  } catch (err) {
    console.error('KHQR verify error:', err.message);
    return res.status(500).json({ error: 'Failed to verify KHQR transaction.' });
  }
});

module.exports = router;
