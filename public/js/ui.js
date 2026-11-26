/**
 * Shared UI helpers used by both the Customer page and the Staff panel:
 * toast notifications, HTML escaping, and inline form-field errors.
 */

/**
 * Friendly display names for order statuses.
 * The server still stores 'preparing' | 'ready' | 'completed' — only the words shown change.
 */
export const STATUS_LABELS = {
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  completed: 'Picked Up',
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || String(status ?? '');
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
  toast.className = `ec-toast ${colors[type] || colors.info} px-4 py-3 rounded-xl shadow-lg text-sm font-medium`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

/**
 * Shows (or clears, when message is empty) an inline error under a form field.
 * Expects an element with id `${input.id}-error` next to the input.
 */
export function setFieldError(input, message = '') {
  if (!input) return;
  const errorEl = document.getElementById(`${input.id}-error`);
  const hasError = Boolean(message);

  input.classList.toggle('is-invalid', hasError);
  input.setAttribute('aria-invalid', String(hasError));

  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.toggle('is-visible', hasError);
  }
}

/** Updates a "12 / 120" character counter element. */
export function updateCharCount(input, counterEl, max) {
  if (!input || !counterEl) return;
  const length = input.value.length;
  counterEl.textContent = `${length} / ${max}`;
  counterEl.classList.toggle('is-over', length > max);
}
