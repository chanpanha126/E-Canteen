/**
 * Teammate 1 Ownership: Digital Menu Display, Category Filtering & Search
 */

import { fetchMenu } from './api.js';
import { addToCart, showToast } from './cart.js';

let allMenuItems = [];
let activeCategory = 'all';
let searchQuery = '';

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

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200">
        <p class="text-slate-500 text-sm">No menu items match your filter.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((item) => {
      const isAvailable = Boolean(item.available);
      return `
        <article class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow ${
          !isAvailable ? 'opacity-70' : ''
        }">
          <div>
            <div class="flex items-start justify-between gap-2 mb-3">
              <div class="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">
                ${item.emoji || '🍽️'}
              </div>
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${
                isAvailable
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }">
                ${isAvailable ? 'Available' : 'Sold Out'}
              </span>
            </div>

            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] uppercase tracking-wider font-semibold text-indigo-600">
                ${item.category}
              </span>
              <span class="text-xs text-amber-500 font-semibold">★ ${Number(item.rating || 4.8).toFixed(1)}</span>
            </div>

            <h3 class="text-base font-bold text-slate-900 mt-1">${item.name}</h3>
            <p class="text-xs text-slate-500 mt-1 line-clamp-2">${item.description || ''}</p>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span class="text-lg font-extrabold text-slate-900">$${Number(item.price).toFixed(2)}</span>
            <button
              type="button"
              data-add-id="${item.id}"
              ${!isAvailable ? 'disabled' : ''}
              class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                isAvailable
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }"
            >
              ${isAvailable ? '+ Add to Cart' : 'Unavailable'}
            </button>
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
      ? 'px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white shadow-sm transition-colors'
      : 'px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors';
  });
}

export async function loadMenu() {
  const grid = document.getElementById('menu-grid');
  if (grid) {
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-sm">Loading AUPP Canteen menu...</div>`;
  }

  try {
    const data = await fetchMenu('all');
    allMenuItems = data.items || [];
    renderMenu();
  } catch (err) {
    showToast(`Failed to load menu: ${err.message}`, 'error');
    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12 bg-rose-50 rounded-2xl border border-rose-200 text-rose-700 text-sm">
          Could not connect to the canteen menu API. Please make sure the server is running.
        </div>
      `;
    }
  }
}

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
    const btn = e.target.closest('button[data-add-id]');
    if (!btn) return;
    const item = allMenuItems.find((m) => m.id === btn.dataset.addId);
    if (item) {
      addToCart(item);
    }
  });

  updateCategoryTabStyles();
  loadMenu();
}
