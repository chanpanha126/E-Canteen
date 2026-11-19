/**
 * Teammate 1 Ownership: Shopping Cart, Table QR Parameter, & Order History State
 */

const CART_STORAGE_KEY = 'ecanteen_cart';
const TABLE_STORAGE_KEY = 'ecanteen_table';
const HISTORY_STORAGE_KEY = 'ecanteen_history';

let cart = loadCart();

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const colors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-slate-900 text-white',
  };

  const toast = document.createElement('div');
  toast.className = `${colors[type] || colors.info} px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all duration-300`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

/**
 * Reads ?table=7 from QR code URL, falls back to localStorage or Table 1.
 */
export function initTableNumber() {
  const params = new URLSearchParams(window.location.search);
  const urlTable = Number(params.get('table'));

  if (Number.isInteger(urlTable) && urlTable > 0) {
    localStorage.setItem(TABLE_STORAGE_KEY, String(urlTable));
  } else if (!localStorage.getItem(TABLE_STORAGE_KEY)) {
    localStorage.setItem(TABLE_STORAGE_KEY, '1');
  }

  renderTableBadge();
}

export function getTableNumber() {
  const saved = Number(localStorage.getItem(TABLE_STORAGE_KEY));
  return Number.isInteger(saved) && saved > 0 ? saved : 1;
}

export function setTableNumber(newTable) {
  const parsed = Number(newTable);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 99) {
    showToast('Please enter a valid table number (1–99).', 'error');
    return false;
  }
  localStorage.setItem(TABLE_STORAGE_KEY, String(parsed));
  renderTableBadge();
  showToast(`Switched to Table #${parsed}`, 'info');
  return true;
}

function renderTableBadge() {
  const badge = document.getElementById('table-badge-number');
  const checkoutTable = document.getElementById('cart-table-number');
  const current = getTableNumber();
  if (badge) badge.textContent = `#${current}`;
  if (checkoutTable) checkoutTable.textContent = `Table #${current}`;
}

export function getCart() {
  return [...cart];
}

export function getCartTotal() {
  return Number(
    cart.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2)
  );
}

export function getCartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

export function addToCart(menuItem) {
  if (!menuItem || !menuItem.available) {
    showToast('Sorry, this item is currently sold out.', 'error');
    return;
  }

  const existing = cart.find((c) => c.id === menuItem.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: menuItem.id,
      name: menuItem.name,
      price: Number(menuItem.price),
      emoji: menuItem.emoji || '🍽️',
      qty: 1,
    });
  }

  saveCart();
  renderCart();
  showToast(`Added ${menuItem.name} to cart`, 'success');
}

export function updateCartQty(itemId, delta) {
  const target = cart.find((c) => c.id === itemId);
  if (!target) return;

  target.qty += delta;
  if (target.qty <= 0) {
    cart = cart.filter((c) => c.id !== itemId);
  }

  saveCart();
  renderCart();
}

export function removeFromCart(itemId) {
  cart = cart.filter((c) => c.id !== itemId);
  saveCart();
  renderCart();
}

export function clearCart() {
  cart = [];
  saveCart();
  renderCart();
}

export function openCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-backdrop');
  if (!drawer || !backdrop) return;
  backdrop.classList.remove('hidden');
  drawer.classList.remove('translate-x-full');
}

export function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-backdrop');
  if (!drawer || !backdrop) return;
  backdrop.classList.add('hidden');
  drawer.classList.add('translate-x-full');
}

export function renderCart() {
  const countBadge = document.getElementById('cart-count-badge');
  const itemsContainer = document.getElementById('cart-items-list');
  const emptyState = document.getElementById('cart-empty-state');
  const subtotalEl = document.getElementById('cart-subtotal');
  const checkoutBtn = document.getElementById('proceed-checkout-btn');

  const count = getCartCount();
  const total = getCartTotal();

  if (countBadge) {
    countBadge.textContent = String(count);
    countBadge.classList.toggle('hidden', count === 0);
  }

  if (subtotalEl) {
    subtotalEl.textContent = `$${total.toFixed(2)}`;
  }

  if (checkoutBtn) {
    checkoutBtn.disabled = cart.length === 0;
  }

  if (!itemsContainer || !emptyState) return;

  if (cart.length === 0) {
    itemsContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  itemsContainer.innerHTML = cart
    .map(
      (item) => `
      <div class="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-2xl shrink-0">${item.emoji}</span>
          <div class="min-w-0">
            <p class="font-semibold text-slate-900 text-sm truncate">${item.name}</p>
            <p class="text-xs text-slate-500">$${item.price.toFixed(2)} each</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-cart-action="dec"
            data-id="${item.id}"
            class="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm"
            aria-label="Decrease quantity"
          >-</button>
          <span class="w-5 text-center text-sm font-semibold text-slate-800">${item.qty}</span>
          <button
            type="button"
            data-cart-action="inc"
            data-id="${item.id}"
            class="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm"
            aria-label="Increase quantity"
          >+</button>
          <button
            type="button"
            data-cart-action="remove"
            data-id="${item.id}"
            class="ml-1 text-rose-500 hover:text-rose-700 text-xs font-medium px-1.5 py-1"
            aria-label="Remove item"
          >✕</button>
        </div>
      </div>
    `
    )
    .join('');
}

export function getOrderHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOrderToHistory(order) {
  const history = getOrderHistory();
  const filtered = history.filter((o) => o.orderId !== order.orderId);
  filtered.unshift(order);
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filtered.slice(0, 20)));
}

export function renderOrderHistoryModal() {
  const listEl = document.getElementById('history-list');
  if (!listEl) return;

  const history = getOrderHistory();
  if (history.length === 0) {
    listEl.innerHTML = `<p class="text-sm text-slate-500 text-center py-8">No past orders recorded on this device yet.</p>`;
    return;
  }

  listEl.innerHTML = history
    .map(
      (order) => `
      <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-900 text-sm">Queue ${order.queueNumber} <span class="text-slate-400 font-normal">(#${order.orderId})</span></span>
          <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${
            order.status === 'ready'
              ? 'bg-emerald-100 text-emerald-700'
              : order.status === 'completed'
              ? 'bg-slate-200 text-slate-700'
              : 'bg-amber-100 text-amber-800'
          }">${order.status.toUpperCase()}</span>
        </div>
        <p class="text-xs text-slate-600">Table #${order.table} • ${order.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}</p>
        <p class="text-xs font-semibold text-slate-800">Total: $${Number(order.totalAmount || 0).toFixed(2)}</p>
      </div>
    `
    )
    .join('');
}

export function initCartEvents() {
  document.getElementById('open-cart-btn')?.addEventListener('click', openCartDrawer);
  document.getElementById('close-cart-btn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cart-backdrop')?.addEventListener('click', closeCartDrawer);

  document.getElementById('cart-items-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cart-action]');
    if (!btn) return;
    const action = btn.dataset.cartAction;
    const id = btn.dataset.id;

    if (action === 'inc') updateCartQty(id, 1);
    else if (action === 'dec') updateCartQty(id, -1);
    else if (action === 'remove') removeFromCart(id);
  });

  // Table badge click to change table
  document.getElementById('table-badge-btn')?.addEventListener('click', () => {
    const next = window.prompt('Enter your AUPP Canteen Table Number (1–99):', String(getTableNumber()));
    if (next !== null) {
      setTableNumber(next.trim());
    }
  });

  // Order history modal toggles
  document.getElementById('open-history-btn')?.addEventListener('click', () => {
    renderOrderHistoryModal();
    document.getElementById('history-modal')?.classList.remove('hidden');
  });
  document.getElementById('close-history-btn')?.addEventListener('click', () => {
    document.getElementById('history-modal')?.classList.add('hidden');
  });

  renderCart();
}
