/**
 * Staff Kitchen Control Panel, Live Demo Trigger, Sales Analytics & Table QR Generator
 * Uses the Orders API: GET (list), PATCH (quick status), PUT (edit order), DELETE (remove order)
 */

import {
  fetchAllOrders,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  fetchMenu,
  updateMenuAvailability,
} from './api.js';
import { escapeHtml, showToast, setFieldError, updateCharCount, getStatusLabel } from './ui.js';

const NOTE_MAX_LENGTH = 120;
const ALLOWED_STATUSES = ['preparing', 'ready', 'completed'];

// Latest orders from GET /api/orders — used to pre-fill the edit form
let currentOrders = [];
// Order id whose "Delete?" confirmation bar is open (survives the 4s auto-refresh)
let pendingDeleteId = null;
// Pause auto-refresh while staff are editing an order
let isEditing = false;
// Which status tab is selected: 'all' | 'preparing' | 'ready' | 'completed'
let activeFilter = 'all';

// Updates the filter tab labels with counts, e.g. "Ready (3)", and highlights the active one
function renderFilterTabs(orders) {
  document.querySelectorAll('#order-filter-tabs button[data-filter]').forEach((btn) => {
    const filter = btn.dataset.filter;
    const count = filter === 'all' ? orders.length : orders.filter((o) => o.status === filter).length;
    const label = filter === 'all' ? 'All' : getStatusLabel(filter);
    const isActive = filter === activeFilter;

    btn.textContent = `${label} (${count})`;
    btn.setAttribute('aria-selected', String(isActive));
    btn.className = isActive
      ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-900 text-white'
      : 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200';
  });
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
          <span class="font-bold text-blue-900">${item.qty} sold</span>
        </div>
      `
      )
      .join('');
  }
}

function renderOrders(allOrders) {
  const container = document.getElementById('staff-orders-list');
  if (!container) return;

  renderFilterTabs(allOrders || []);

  if (!allOrders || allOrders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-500 text-sm">
        No orders yet. Open the Customer Menu, place an order, and it will appear here automatically.
      </div>
    `;
    return;
  }

  const orders =
    activeFilter === 'all' ? allOrders : allOrders.filter((o) => o.status === activeFilter);

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-500 text-sm">
        No <strong>${escapeHtml(getStatusLabel(activeFilter))}</strong> orders right now.
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

      const isConfirmingDelete = pendingDeleteId === order.orderId;

      return `
        <article data-order-card="${order.orderId}" class="ec-order-card ec-status-${escapeHtml(order.status)} p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-base font-black text-slate-900">Queue ${escapeHtml(order.queueNumber)}</span>
                <span class="text-xs text-slate-500 font-mono">#${order.orderId}</span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-950">Table #${order.table}</span>
                <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${badgeClass}">${escapeHtml(getStatusLabel(order.status)).toUpperCase()}</span>
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
                // Only show the next step: preparing → ready → picked up
                order.status === 'preparing'
                  ? `<button
                      type="button"
                      data-status-btn="ready"
                      data-order-id="${order.orderId}"
                      class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                    ><i class="fa-solid fa-bell" aria-hidden="true"></i> Food Done – Notify Customer</button>`
                  : ''
              }
              ${
                order.status === 'ready'
                  ? `<button
                      type="button"
                      data-status-btn="completed"
                      data-order-id="${order.orderId}"
                      class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold"
                    ><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i> Picked Up</button>`
                  : ''
              }
              ${
                // Undo button in case staff clicked "Food Done" by mistake
                order.status === 'ready'
                  ? `<button
                      type="button"
                      data-status-btn="preparing"
                      data-order-id="${order.orderId}"
                      class="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                    ><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Back to Preparing</button>`
                  : ''
              }
              <button
                type="button"
                data-edit-order="${order.orderId}"
                class="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-950 text-xs font-semibold"
              ><i class="fa-solid fa-pen" aria-hidden="true"></i> Edit</button>
              <button
                type="button"
                data-delete-order="${order.orderId}"
                class="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-semibold"
              ><i class="fa-solid fa-trash-can" aria-hidden="true"></i> Delete</button>
            </div>
          </div>
          ${
            isConfirmingDelete
              ? `<div class="ec-confirm-bar px-3 py-2 flex flex-wrap items-center justify-between gap-2" role="alert">
                  <p class="text-xs font-semibold text-rose-700">Delete order #${order.orderId} (Queue ${escapeHtml(order.queueNumber)})? This cannot be undone.</p>
                  <div class="flex gap-2">
                    <button type="button" data-cancel-delete="${order.orderId}" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold">Keep</button>
                    <button type="button" data-confirm-delete="${order.orderId}" class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold">Yes, delete</button>
                  </div>
                </div>`
              : ''
          }
        </article>
      `;
    })
    .join('');
}

function setSyncStatus(online, message) {
  const statusEl = document.getElementById('orders-sync-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('is-offline', !online);
}

async function loadOrdersAndAnalytics() {
  try {
    const data = await fetchAllOrders();
    currentOrders = data.orders || [];
    renderAnalytics(data.analytics || {});
    renderOrders(currentOrders);
    setSyncStatus(true, `Auto-refreshes every 4s • updated ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error('Failed to refresh orders:', err.message);
    setSyncStatus(false, 'Connection lost — retrying...');

    // Only replace the list with an error if there is nothing to show yet
    const container = document.getElementById('staff-orders-list');
    if (container && currentOrders.length === 0) {
      container.innerHTML = `
        <div class="ec-error-state p-5 text-center space-y-2">
          <p class="text-sm font-semibold">Could not load orders.</p>
          <p class="text-xs">${escapeHtml(err.message)}</p>
          <button type="button" data-retry-orders class="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold">Retry</button>
        </div>
      `;
    }
  }
}

/* ---------- Edit order (PUT /api/orders/:orderId) ---------- */

function validateEditForm() {
  const statusInput = document.getElementById('edit-order-status');
  const noteInput = document.getElementById('edit-order-note');
  let isValid = true;

  if (!statusInput.value) {
    setFieldError(statusInput, 'Please choose a status.');
    isValid = false;
  } else if (!ALLOWED_STATUSES.includes(statusInput.value)) {
    setFieldError(statusInput, 'Invalid status selected.');
    isValid = false;
  } else {
    setFieldError(statusInput);
  }

  const note = noteInput.value.trim();
  if (note.length > NOTE_MAX_LENGTH) {
    setFieldError(noteInput, `Note must be ${NOTE_MAX_LENGTH} characters or fewer (currently ${note.length}).`);
    isValid = false;
  } else if (/[<>]/.test(note)) {
    setFieldError(noteInput, 'Note cannot contain < or > characters.');
    isValid = false;
  } else {
    setFieldError(noteInput);
  }

  return isValid;
}

function openEditOrderModal(orderId) {
  const order = currentOrders.find((o) => o.orderId === orderId);
  if (!order) {
    showToast('That order no longer exists.', 'error');
    return;
  }

  isEditing = true;
  const statusInput = document.getElementById('edit-order-status');
  const noteInput = document.getElementById('edit-order-note');

  document.getElementById('edit-order-id').value = String(order.orderId);
  document.getElementById('edit-order-meta').textContent =
    `Order #${order.orderId} • Queue ${order.queueNumber} • Table #${order.table}`;
  statusInput.value = order.status;
  noteInput.value = order.customerNote || '';

  setFieldError(statusInput);
  setFieldError(noteInput);
  updateCharCount(noteInput, document.getElementById('edit-order-note-count'), NOTE_MAX_LENGTH);

  document.getElementById('edit-order-modal').classList.remove('hidden');
  statusInput.focus();
}

function closeEditOrderModal() {
  isEditing = false;
  document.getElementById('edit-order-modal')?.classList.add('hidden');
}

async function handleEditOrderSubmit(e) {
  e.preventDefault();
  if (!validateEditForm()) return;

  const orderId = Number(document.getElementById('edit-order-id').value);
  const status = document.getElementById('edit-order-status').value;
  const customerNote = document.getElementById('edit-order-note').value.trim();
  const saveBtn = document.getElementById('save-edit-order-btn');

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    await updateOrder(orderId, { status, customerNote });
    closeEditOrderModal();
    showToast(`Order #${orderId} updated.`, 'success');
    await loadOrdersAndAnalytics();
  } catch (err) {
    showToast(`Failed to update order: ${err.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
}

/* ---------- Delete order (DELETE /api/orders/:orderId) ---------- */

async function handleDeleteOrder(orderId, btn) {
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    await deleteOrder(orderId);
    pendingDeleteId = null;

    // Animate the card out immediately, then refresh from the server
    document.querySelector(`[data-order-card="${orderId}"]`)?.classList.add('is-removing');
    showToast(`Order #${orderId} deleted.`, 'success');
    setTimeout(loadOrdersAndAnalytics, 250);
  } catch (err) {
    showToast(`Failed to delete order: ${err.message}`, 'error');
    btn.disabled = false;
    btn.textContent = 'Yes, delete';
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
            <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(item.name)}</p>
            <p class="text-[11px] text-slate-500">$${Number(item.price).toFixed(2)}</p>
          </div>
          <button
            type="button"
            data-toggle-item="${escapeHtml(item.id)}"
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
    container.innerHTML = `
      <div class="ec-error-state p-3 text-center space-y-2">
        <p class="text-xs">Failed to load menu: ${escapeHtml(err.message)}</p>
        <button type="button" data-retry-menu class="px-3 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold">Retry</button>
      </div>
    `;
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
    if (e.target.closest('button[data-retry-orders]')) {
      loadOrdersAndAnalytics();
      return;
    }

    const editBtn = e.target.closest('button[data-edit-order]');
    if (editBtn) {
      openEditOrderModal(Number(editBtn.dataset.editOrder));
      return;
    }

    const deleteBtn = e.target.closest('button[data-delete-order]');
    if (deleteBtn) {
      pendingDeleteId = Number(deleteBtn.dataset.deleteOrder);
      renderOrders(currentOrders);
      return;
    }

    const cancelDeleteBtn = e.target.closest('button[data-cancel-delete]');
    if (cancelDeleteBtn) {
      pendingDeleteId = null;
      renderOrders(currentOrders);
      return;
    }

    const confirmDeleteBtn = e.target.closest('button[data-confirm-delete]');
    if (confirmDeleteBtn) {
      await handleDeleteOrder(Number(confirmDeleteBtn.dataset.confirmDelete), confirmDeleteBtn);
      return;
    }

    const btn = e.target.closest('button[data-status-btn]');
    if (!btn) return;
    const orderId = Number(btn.dataset.orderId);
    const status = btn.dataset.statusBtn;
    btn.disabled = true;

    try {
      await updateOrderStatus(orderId, status);
      await loadOrdersAndAnalytics();
    } catch (err) {
      showToast(`Failed to update status: ${err.message}`, 'error');
      btn.disabled = false;
    }
  });

  document.getElementById('staff-menu-list')?.addEventListener('click', async (e) => {
    if (e.target.closest('button[data-retry-menu]')) {
      loadStaffMenu();
      return;
    }

    const btn = e.target.closest('button[data-toggle-item]');
    if (!btn) return;
    const itemId = btn.dataset.toggleItem;
    const nextAvailable = btn.dataset.nextAvailable === 'true';
    btn.disabled = true;

    try {
      await updateMenuAvailability(itemId, nextAvailable);
      await loadStaffMenu();
    } catch (err) {
      showToast(`Failed to update item: ${err.message}`, 'error');
      btn.disabled = false;
    }
  });

  document.getElementById('generate-table-qr-btn')?.addEventListener('click', renderTableQrCode);

  // Status filter tabs — re-render from the orders we already have (no new request needed)
  document.getElementById('order-filter-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    renderOrders(currentOrders);
  });

  // Edit order modal (PUT)
  document.getElementById('edit-order-form')?.addEventListener('submit', handleEditOrderSubmit);
  document.getElementById('close-edit-order-btn')?.addEventListener('click', closeEditOrderModal);
  document.getElementById('cancel-edit-order-btn')?.addEventListener('click', closeEditOrderModal);
  document.getElementById('edit-order-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'edit-order-modal') closeEditOrderModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isEditing) closeEditOrderModal();
  });

  // Live validation feedback while typing
  const noteInput = document.getElementById('edit-order-note');
  noteInput?.addEventListener('input', () => {
    updateCharCount(noteInput, document.getElementById('edit-order-note-count'), NOTE_MAX_LENGTH);
    if (noteInput.classList.contains('is-invalid')) validateEditForm();
  });
  document.getElementById('edit-order-status')?.addEventListener('change', validateEditForm);

  loadOrdersAndAnalytics();
  loadStaffMenu();
  renderTableQrCode();

  // Keep kitchen queue fresh every 4 seconds (paused while the edit form is open)
  setInterval(() => {
    if (!isEditing) loadOrdersAndAnalytics();
  }, 4000);
}

initStaffPage();
