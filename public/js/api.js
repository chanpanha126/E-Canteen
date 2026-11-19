/**
 * Shared REST API client using native Fetch API + async/await.
 * Used by both Customer (index.html) and Staff (staff.html) pages.
 */

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

export function fetchMenu(category = 'all') {
  const query = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
  return request(`/api/menu${query}`);
}

export function updateMenuAvailability(itemId, available) {
  return request(`/api/menu/${encodeURIComponent(itemId)}/availability`, {
    method: 'PATCH',
    body: JSON.stringify({ available }),
  });
}

export function generateKhqrPayment({ amount, currency = 'USD', useDemoAmount = false }) {
  return request('/api/payments/khqr/generate', {
    method: 'POST',
    body: JSON.stringify({ amount, currency, useDemoAmount }),
  });
}

export function verifyKhqrPayment({ md5, amount, currency = 'USD', simulate = false }) {
  return request('/api/payments/khqr/verify', {
    method: 'POST',
    body: JSON.stringify({ md5, amount, currency, simulate }),
  });
}

export function createOrder({ table, items, paymentMd5, customerNote }) {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ table, items, paymentMd5, customerNote }),
  });
}

export function fetchOrderStatus(orderId) {
  return request(`/api/orders/${encodeURIComponent(orderId)}/status`);
}

export function fetchAllOrders() {
  return request('/api/orders');
}

export function updateOrderStatus(orderId, status) {
  return request(`/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
