/**
 * Staff Kitchen Control Panel, Live Demo Trigger, Sales Analytics & Table QR Generator
 */

import {
  fetchAllOrders,
  updateOrderStatus,
  fetchMenu,
  updateMenuAvailability,
} from './api.js';

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderAnalytics(analytics) {
  document.getElementById('stat-total-orders').textContent = String(analytics.totalOrders || 0);
  document.getElementById('stat-total-revenue').textContent = `$${Number(analytics.totalRevenue || 0).toFixed(2)}`;
  document.getElementById('stat-preparing').textContent = String(analytics.preparingCount || 0);
  document.getElementById('stat-ready').textContent = String(analytics.readyCount || 0);

  const topItemsEl = document.getElementById('top-items-list');
  const topItems = analytics.topItems || [];
  if (topItems.length === 0) {
    topItemsEl.innerHTML = `<p class="text-slate-400">No orders placed yet.</p>`;
  } else {
    topItemsEl.innerHTML = topItems
      .map(
        (item, idx) => `
        <div class="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
          <span class="font-medium text-slate-800">${idx + 1}. ${escapeHtml(item.name)}</span>
          <span class="font-bold text-indigo-600">${item.qty} sold</span>
        </div>
      `
      )
      .join('');
  }
}

function renderOrders(orders) {
  const container = document.getElementById('staff-orders-list');
  if (!container) return;

  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-500 text-sm">
        No orders yet. Open the Customer Menu, place an order, and it will appear here automatically.
      </div>
    `;
    return;
  }

  container.innerHTML = orders
    .map((order) => {
      const badgeClass =
        order.status === 'ready'
          ? 'bg-emerald-100 text-emerald-800'
          : order.status === 'completed'
          ? 'bg-slate-200 text-slate-700'
          : 'bg-amber-100 text-amber-800';

      return `
        <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-base font-black text-slate-900">Queue ${order.queueNumber}</span>
              <span class="text-xs text-slate-500 font-mono">#${order.orderId}</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">Table #${order.table}</span>
              <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${badgeClass}">${order.status.toUpperCase()}</span>
            </div>
            <p class="text-sm text-slate-700">
              ${(order.items || []).map((i) => `${i.qty}× ${escapeHtml(i.name)}`).join(', ')}
            </p>
            ${
              order.customerNote
                ? `<p class="text-xs text-rose-600 font-medium">Note: ${escapeHtml(order.customerNote)}</p>`
                : ''
            }
            <p class="text-xs font-bold text-slate-800">Total: $${Number(order.totalAmount || 0).toFixed(2)}</p>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            ${
              order.status !== 'ready'
                ? `<button
                    type="button"
                    data-status-btn="ready"
                    data-order-id="${order.orderId}"
                    class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                  >Mark Pickup Ready 🔔</button>`
                : ''
            }
            ${
              order.status !== 'completed'
                ? `<button
                    type="button"
                    data-status-btn="completed"
                    data-order-id="${order.orderId}"
                    class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold"
                  >Completed ✓</button>`
                : ''
            }
            ${
              order.status !== 'preparing'
                ? `<button
                    type="button"
                    data-status-btn="preparing"
                    data-order-id="${order.orderId}"
                    class="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                  >Reset Preparing</button>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');
}

async function loadOrdersAndAnalytics() {
  try {
    const data = await fetchAllOrders();
    renderAnalytics(data.analytics || {});
    renderOrders(data.orders || []);
  } catch (err) {
    console.error('Failed to refresh orders:', err.message);
  }
}

async function loadStaffMenu() {
  const container = document.getElementById('staff-menu-list');
  if (!container) return;

  try {
    const data = await fetchMenu('all');
    const items = data.items || [];
    container.innerHTML = items
      .map(
        (item) => `
        <div class="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
          <div class="min-w-0">
            <p class="text-xs font-bold text-slate-800 truncate">${item.emoji || ''} ${item.name}</p>
            <p class="text-[11px] text-slate-500">$${Number(item.price).toFixed(2)}</p>
          </div>
          <button
            type="button"
            data-toggle-item="${item.id}"
            data-next-available="${!item.available}"
            class="px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
              item.available
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
            }"
          >
            ${item.available ? 'Available' : 'Sold Out'}
          </button>
        </div>
      `
      )
      .join('');
  } catch (err) {
    container.innerHTML = `<p class="text-xs text-rose-600">Failed to load menu.</p>`;
  }
}

function renderTableQrCode() {
  const baseInput = document.getElementById('qr-base-url');
  const tableInput = document.getElementById('qr-table-input');
  const container = document.getElementById('table-qr-container');
  const linkEl = document.getElementById('table-qr-link');

  if (!baseInput || !tableInput || !container || !linkEl) return;

  const baseUrl = baseInput.value.trim().replace(/\/+$/, '');
  const tableNum = Math.max(1, Math.min(99, Number(tableInput.value) || 1));
  const targetUrl = `${baseUrl}/?table=${tableNum}`;

  linkEl.href = targetUrl;
  linkEl.textContent = targetUrl;
  container.innerHTML = '';

  if (typeof window.QRCode === 'function') {
    new window.QRCode(container, {
      text: targetUrl,
      width: 160,
      height: 160,
    });
  } else {
    container.innerHTML = `<p class="text-xs text-slate-500 p-4">QR generator unavailable offline</p>`;
  }
}

function initStaffPage() {
  const baseInput = document.getElementById('qr-base-url');
  if (baseInput) {
    baseInput.value = window.location.origin;
  }

  document.getElementById('refresh-staff-btn')?.addEventListener('click', () => {
    loadOrdersAndAnalytics();
    loadStaffMenu();
  });

  document.getElementById('staff-orders-list')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-status-btn]');
    if (!btn) return;
    const orderId = Number(btn.dataset.orderId);
    const status = btn.dataset.statusBtn;
    btn.disabled = true;

    try {
      await updateOrderStatus(orderId, status);
      await loadOrdersAndAnalytics();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
      btn.disabled = false;
    }
  });

  document.getElementById('staff-menu-list')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-toggle-item]');
    if (!btn) return;
    const itemId = btn.dataset.toggleItem;
    const nextAvailable = btn.dataset.nextAvailable === 'true';
    btn.disabled = true;

    try {
      await updateMenuAvailability(itemId, nextAvailable);
      await loadStaffMenu();
    } catch (err) {
      alert(`Failed to update item: ${err.message}`);
      btn.disabled = false;
    }
  });

  document.getElementById('generate-table-qr-btn')?.addEventListener('click', renderTableQrCode);

  loadOrdersAndAnalytics();
  loadStaffMenu();
  renderTableQrCode();

  // Keep kitchen queue fresh every 4 seconds
  setInterval(loadOrdersAndAnalytics, 4000);
}

initStaffPage();
