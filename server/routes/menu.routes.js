const express = require('express');
const { getMenuItems, saveMenuItems } = require('../services/store');

const router = express.Router();

const ALLOWED_CATEGORIES = ['food', 'dessert', 'drinks'];

// GET /api/menu — returns all menu items (or filters by ?category=food|dessert|drinks)
router.get('/', (req, res) => {
  const { category } = req.query;
  const allItems = getMenuItems();

  if (category && category !== 'all') {
    const normalized = String(category).toLowerCase();
    if (!ALLOWED_CATEGORIES.includes(normalized)) {
      return res.status(400).json({ error: 'Invalid category filter.' });
    }
    return res.json({
      items: allItems.filter((item) => item.category === normalized),
    });
  }

  return res.json({ items: allItems });
});

// PATCH /api/menu/:id/availability — toggles whether an item is available or sold out
router.patch('/:id/availability', (req, res) => {
  const { id } = req.params;
  const { available } = req.body;

  if (typeof available !== 'boolean') {
    return res.status(400).json({ error: '`available` must be a boolean.' });
  }

  const items = getMenuItems();
  const target = items.find((item) => item.id === id);

  if (!target) {
    return res.status(404).json({ error: 'Menu item not found.' });
  }

  target.available = available;
  saveMenuItems(items);

  return res.json({ item: target });
});

module.exports = router;
