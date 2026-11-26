/**
 * Customer page: menu cards with photos, category chips, search,
 * and the food details sheet (photo, description, quantity picker).
 */

import { fetchMenu } from './api.js';
import { addToCart, getCart, showToast } from './cart.js';
import { escapeHtml } from './ui.js';

let allMenuItems = [];
let activeCategory = 'all';
let searchQuery = '';

// Food details sheet state
let sheetItem = null; // the menu item currently shown in the sheet
let sheetQty = 1;     // quantity chosen with the − / + buttons

// Returns how many of this item are already in the cart (0 if none)
function getQtyInCart(itemId) {
  const found = getCart().find((c) => c.id === itemId);
  return found ? found.qty : 0;
}

/**
 * HTML for a food photo. If the image file is missing, the inline onerror
 * removes the <img> and the grey .ec-photo box (with an icon) shows instead.
 */
function photoHtml(item, extraClasses = '') {
  if (!item.image) {
    return `<div class="ec-photo is-missing ${extraClasses}"></div>`;
  }
  return `
    <div class="ec-photo ${extraClasses}">
      <img
        src="${escapeHtml(item.image)}"
        alt="${escapeHtml(item.name)}"
        loading="lazy"
        class="w-full h-full object-cover"
        onerror="this.parentElement.classList.add('is-missing'); this.remove();"
      />
    </div>
  `;
}

function renderResultCount(shown) {
  const countEl = document.getElementById('menu-result-count');
  if (!countEl) return;
  const label = shown === 1 ? 'item' : 'items';
  countEl.textContent = searchQuery ? `${shown} ${label} found for "${searchQuery}"` : `${shown} ${label}`;
}

// Filters the loaded menu by active category & search text, then renders the customer menu cards
function renderMenu() {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;

  const filtered = allMenuItems.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery) ||
      item.description.toLowerCase().includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  renderResultCount(filtered.length);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 bg-white rounded-3xl border border-slate-200 space-y-3">
        <p class="text-3xl text-slate-300"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></p>
        <p class="text-slate-500 text-sm">No menu items match your search.</p>
        <button type="button" id="clear-search-btn" class="px-4 py-2 rounded-xl bg-blue-50 text-blue-950 text-xs font-bold hover:bg-blue-100">
          Clear search &amp; show all
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((item) => {
      const isAvailable = Boolean(item.available);
      const qtyInCart = getQtyInCart(item.id);

      return `
        <article
          data-open-id="${escapeHtml(item.id)}"
          class="ec-menu-card bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg cursor-pointer flex flex-col ${
            !isAvailable ? 'opacity-60' : ''
          }"
          tabindex="0"
          aria-label="${escapeHtml(item.name)}, $${Number(item.price).toFixed(2)}"
        >
          <div class="relative">
            ${photoHtml(item, 'aspect-[4/3]')}
            <span class="ec-rating absolute top-2 left-2"><i class="fa-solid fa-star" aria-hidden="true"></i> ${Number(item.rating || 4.8).toFixed(1)}</span>
            ${
              !isAvailable
                ? `<span class="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white text-sm font-bold">Sold Out</span>`
                : ''
            }
            ${qtyInCart > 0 ? `<span class="ec-in-cart absolute top-2 right-2">In cart ×${qtyInCart}</span>` : ''}
          </div>

          <div class="p-3 sm:p-4 flex flex-col flex-1">
            <p class="text-[10px] uppercase tracking-wider font-bold text-blue-900">${escapeHtml(item.category)}</p>
            <h3 class="text-sm sm:text-base font-bold text-slate-900 leading-snug">${escapeHtml(item.name)}</h3>
            <p class="hidden sm:block text-xs text-slate-500 mt-1 line-clamp-2">${escapeHtml(item.description || '')}</p>

            <div class="mt-auto pt-3 flex items-center justify-between">
              <span class="text-base sm:text-lg font-extrabold text-slate-900">$${Number(item.price).toFixed(2)}</span>
              <button
                type="button"
                data-add-id="${escapeHtml(item.id)}"
                class="ec-add-btn"
                ${!isAvailable ? 'disabled' : ''}
                aria-label="Add ${escapeHtml(item.name)} to cart"
              >+</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function updateCategoryTabStyles() {
  document.querySelectorAll('button[data-category]').forEach((btn) => {
    const isActive = btn.dataset.category === activeCategory;
    btn.className = isActive
      ? 'flex flex-col items-center justify-center gap-1 py-2 rounded-2xl text-xs sm:flex-row sm:gap-0 sm:pl-1.5 sm:pr-4 sm:py-1.5 sm:rounded-full sm:text-sm whitespace-nowrap font-bold bg-blue-900 text-white shadow-md shadow-blue-200'
      : 'flex flex-col items-center justify-center gap-1 py-2 rounded-2xl text-xs sm:flex-row sm:gap-0 sm:pl-1.5 sm:pr-4 sm:py-1.5 sm:rounded-full sm:text-sm whitespace-nowrap font-semibold bg-white text-slate-700 shadow-sm hover:bg-blue-50';
  });
}

// Grey pulsing placeholder cards while the menu is loading
function renderLoadingSkeleton() {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 6 }, () => `<div class="ec-skeleton" aria-hidden="true"></div>`).join('');
  const countEl = document.getElementById('menu-result-count');
  if (countEl) countEl.textContent = 'Loading...';
}

// Fetches the menu from GET /api/menu; shows loading skeletons first and a retry box on failure
export async function loadMenu() {
  const grid = document.getElementById('menu-grid');
  renderLoadingSkeleton();

  try {
    const data = await fetchMenu('all');
    allMenuItems = data.items || [];
    renderMenu();
  } catch (err) {
    showToast(`Failed to load menu: ${err.message}`, 'error');
    const countEl = document.getElementById('menu-result-count');
    if (countEl) countEl.textContent = '';
    if (grid) {
      grid.innerHTML = `
        <div class="ec-error-state col-span-full text-center py-10 px-4 text-sm space-y-3">
          <p class="font-semibold">Could not load the canteen menu.</p>
          <p class="text-xs">${escapeHtml(err.message)}</p>
          <button type="button" id="retry-menu-btn" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Try Again</button>
        </div>
      `;
    }
  }
}

function clearSearch() {
  const searchInput = document.getElementById('menu-search');
  if (searchInput) searchInput.value = '';
  searchQuery = '';
  activeCategory = 'all';
  updateCategoryTabStyles();
  renderMenu();
}

/* ---------- Food details sheet ---------- */

function renderSheetQty() {
  document.getElementById('sheet-qty').textContent = String(sheetQty);
  const total = Number(sheetItem.price) * sheetQty;
  const addBtn = document.getElementById('sheet-add-btn');
  addBtn.disabled = !sheetItem.available;
  addBtn.textContent = sheetItem.available
    ? `Add ${sheetQty} to cart • $${total.toFixed(2)}`
    : 'Sold out';
}

// Opens the customer food-details sheet with a larger photo, description, and quantity picker
function openFoodSheet(item) {
  sheetItem = item;
  sheetQty = 1;

  const photo = document.getElementById('sheet-photo');
  const photoBox = photo.parentElement;
  photoBox.classList.toggle('is-missing', !item.image);
  photo.hidden = !item.image;
  photo.src = item.image || '';
  photo.alt = item.name;
  photo.onerror = () => {
    photo.hidden = true;
    photoBox.classList.add('is-missing');
  };

  document.getElementById('sheet-category').textContent = item.category;
  document.getElementById('sheet-name').textContent = item.name;
  document.getElementById('sheet-rating').innerHTML = `<i class="fa-solid fa-star" aria-hidden="true"></i> ${Number(item.rating || 4.8).toFixed(1)}`;
  document.getElementById('sheet-description').textContent = item.description || '';
  document.getElementById('sheet-price').textContent = `$${Number(item.price).toFixed(2)}`;
  renderSheetQty();

  document.getElementById('food-sheet').classList.remove('hidden');
}

function closeFoodSheet() {
  sheetItem = null;
  document.getElementById('food-sheet')?.classList.add('hidden');
}

function initFoodSheetEvents() {
  document.getElementById('close-sheet-btn')?.addEventListener('click', closeFoodSheet);

  // Click on the dark background (outside the panel) closes the sheet
  document.getElementById('food-sheet')?.addEventListener('click', (e) => {
    if (e.target.id === 'food-sheet') closeFoodSheet();
  });

  document.getElementById('sheet-dec-btn')?.addEventListener('click', () => {
    if (sheetQty > 1) sheetQty -= 1;
    renderSheetQty();
  });

  document.getElementById('sheet-inc-btn')?.addEventListener('click', () => {
    if (sheetQty < 20) sheetQty += 1;
    renderSheetQty();
  });

  document.getElementById('sheet-add-btn')?.addEventListener('click', () => {
    if (!sheetItem) return;
    addToCart(sheetItem, sheetQty);
    closeFoodSheet();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetItem) closeFoodSheet();
  });
}

// Sets up customer menu interactions: category tabs, live search, quick-add "+", card tap, and cart sync
export function initMenuEvents() {
  document.getElementById('category-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-category]');
    if (!btn) return;
    activeCategory = btn.dataset.category;
    updateCategoryTabStyles();
    renderMenu();
  });

  document.getElementById('menu-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderMenu();
  });

  document.getElementById('menu-grid')?.addEventListener('click', (e) => {
    if (e.target.closest('#retry-menu-btn')) {
      loadMenu();
      return;
    }

    if (e.target.closest('#clear-search-btn')) {
      clearSearch();
      return;
    }

    // "+" button: quick add one item (don't open the sheet)
    const addBtn = e.target.closest('button[data-add-id]');
    if (addBtn) {
      const item = allMenuItems.find((m) => m.id === addBtn.dataset.addId);
      if (item) addToCart(item);
      return;
    }

    // Anywhere else on the card: open the food details sheet
    const card = e.target.closest('[data-open-id]');
    if (card) {
      const item = allMenuItems.find((m) => m.id === card.dataset.openId);
      if (item) openFoodSheet(item);
    }
  });

  // Keyboard users: Enter on a focused card opens the sheet
  document.getElementById('menu-grid')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.closest('button')) return;
    const card = e.target.closest('[data-open-id]');
    const item = card && allMenuItems.find((m) => m.id === card.dataset.openId);
    if (item) openFoodSheet(item);
  });

  // cart.js fires this event whenever the cart changes → refresh "In cart" badges
  document.addEventListener('cart:updated', () => {
    if (allMenuItems.length > 0) renderMenu();
  });

  initFoodSheetEvents();
  updateCategoryTabStyles();
  loadMenu();
}
