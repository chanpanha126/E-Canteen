/**
 * Teammate 2 Ownership: Live Order Tracking (Fetch API Polling) & Web Notifications API
 */

import { fetchOrderStatus } from './api.js';
import { saveOrderToHistory, showToast } from './cart.js';

const ACTIVE_ORDER_KEY = 'ecanteen_active_order';
let pollingTimer = null;
let notifiedReadyForOrderId = null;

/**
 * Requests browser Web Notification permission cleanly.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'default';
  }
}

/**
 * Plays a gentle 2-note chime via Web Audio API when pickup is ready.
 */
function playPickupChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);
      gain.gain.setValueAtTime(0.15, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.36);
    });
  } catch {
    // Audio playback may be restricted without user gesture
  }
}

/**
 * Dispatches browser-native Web Notification + in-app alert banner.
 */
function triggerPickupReadyAlert(queueNumber, orderId) {
  if (notifiedReadyForOrderId === orderId) return;
  notifiedReadyForOrderId = orderId;

  const message = `Queue ${queueNumber} is ready for pickup!`;
  playPickupChime();
  showToast(message, 'success');

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('AUPP E-Canteen — Order Ready!', {
      body: message,
      tag: `order-${orderId}`,
    });
  }
}

function renderTrackingCard(order) {
  const section = document.getElementById('order-tracking-section');
  const queueEl = document.getElementById('tracking-queue-number');
  const metaEl = document.getElementById('tracking-order-meta');
  const statusBadge = document.getElementById('tracking-status-badge');
  const statusMessage = document.getElementById('tracking-status-message');
  const pollingLabel = document.getElementById('tracking-polling-indicator');

  if (!section) return;
  section.classList.remove('hidden');

  if (queueEl) queueEl.textContent = order.queueNumber;
  if (metaEl) metaEl.textContent = `Order #${order.orderId} • Table #${order.table}`;

  if (order.status === 'ready') {
    if (statusBadge) {
      statusBadge.textContent = 'READY FOR PICKUP';
      statusBadge.className =
        'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white animate-bounce';
    }
    if (statusMessage) {
      statusMessage.textContent = `Queue ${order.queueNumber} is ready for pickup! Please head to the AUPP Canteen counter.`;
      statusMessage.className = 'text-sm font-semibold text-emerald-800 mt-1';
    }
    if (pollingLabel) {
      pollingLabel.textContent = 'Live update complete • Ready for pickup';
    }
    section.classList.remove('border-indigo-200', 'bg-indigo-50');
    section.classList.add('border-emerald-400', 'bg-emerald-50');
  } else if (order.status === 'completed') {
    if (statusBadge) {
      statusBadge.textContent = 'PICKED UP';
      statusBadge.className =
        'px-3 py-1 rounded-full text-xs font-bold bg-slate-600 text-white';
    }
    if (statusMessage) {
      statusMessage.textContent = 'Order completed. Enjoy your meal!';
      statusMessage.className = 'text-sm text-slate-700 mt-1';
    }
    if (pollingLabel) {
      pollingLabel.textContent = 'Order closed';
    }
  } else {
    if (statusBadge) {
      statusBadge.textContent = 'PREPARING';
      statusBadge.className =
        'px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-amber-950';
    }
    if (statusMessage) {
      statusMessage.textContent = 'The canteen kitchen is preparing your food. We will notify you as soon as it is ready.';
      statusMessage.className = 'text-sm text-indigo-900 mt-1';
    }
    if (pollingLabel) {
      pollingLabel.textContent = 'Checking status every 3s via Fetch API...';
    }
    section.classList.remove('border-emerald-400', 'bg-emerald-50');
    section.classList.add('border-indigo-200', 'bg-indigo-50');
  }

  updateNotificationBanner();
}

function updateNotificationBanner() {
  const btn = document.getElementById('enable-notifications-btn');
  if (!btn) return;
  if (!('Notification' in window)) {
    btn.classList.add('hidden');
    return;
  }
  if (Notification.permission === 'granted') {
    btn.textContent = '🔔 Pickup Alerts Enabled';
    btn.disabled = true;
    btn.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800';
  } else if (Notification.permission === 'denied') {
    btn.textContent = '🔕 Browser Alerts Blocked (In-App Active)';
    btn.disabled = true;
    btn.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-200 text-slate-600';
  } else {
    btn.textContent = '🔔 Enable Pickup Notification';
    btn.disabled = false;
    btn.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700';
  }
}

export function stopOrderPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

/**
 * Starts polling GET /api/orders/:orderId/status every 3 seconds using the Fetch API.
 */
export function startOrderTracking(order) {
  stopOrderPolling();
  localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(order));
  renderTrackingCard(order);

  if (order.status === 'ready') {
    triggerPickupReadyAlert(order.queueNumber, order.orderId);
    return;
  }
  if (order.status === 'completed') {
    return;
  }

  const pollOnce = async () => {
    try {
      const latest = await fetchOrderStatus(order.orderId);
      const updatedOrder = { ...order, status: latest.status, queueNumber: latest.queueNumber };
      localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(updatedOrder));
      saveOrderToHistory(updatedOrder);
      renderTrackingCard(updatedOrder);

      if (latest.status === 'ready') {
        stopOrderPolling();
        triggerPickupReadyAlert(latest.queueNumber, latest.orderId);
      } else if (latest.status === 'completed') {
        stopOrderPolling();
      }
    } catch (err) {
      console.warn('Order status poll retry:', err.message);
    }
  };

  pollingTimer = setInterval(pollOnce, 3000);
}

export function initTrackingEvents() {
  document.getElementById('enable-notifications-btn')?.addEventListener('click', async () => {
    await requestNotificationPermission();
    updateNotificationBanner();
  });

  document.getElementById('dismiss-tracking-btn')?.addEventListener('click', () => {
    stopOrderPolling();
    localStorage.removeItem(ACTIVE_ORDER_KEY);
    document.getElementById('order-tracking-section')?.classList.add('hidden');
  });

  // Resume tracking if the customer refreshes the browser tab
  try {
    const raw = localStorage.getItem(ACTIVE_ORDER_KEY);
    if (raw) {
      const savedOrder = JSON.parse(raw);
      if (savedOrder && savedOrder.orderId) {
        startOrderTracking(savedOrder);
      }
    }
  } catch {
    localStorage.removeItem(ACTIVE_ORDER_KEY);
  }
}
