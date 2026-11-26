/**
 * Teammate 2 Ownership: Bakong KHQR Checkout Modal, Payment Verification, & Order Submission
 */

import { generateKhqrPayment, verifyKhqrPayment, createOrder } from './api.js';
import {
  getCart,
  getCartTotal,
  getTableNumber,
  setTableNumber,
  clearCart,
  closeCartDrawer,
  saveOrderToHistory,
  showToast,
} from './cart.js';
import { setFieldError, updateCharCount } from './ui.js';
import { requestNotificationPermission, startOrderTracking } from './tracking.js';

const NOTE_MAX_LENGTH = 120;

let currentKhqrSession = null;
let khqrVerifyTimer = null;
let isSubmittingOrder = false;

function stopKhqrVerificationPolling() {
  if (khqrVerifyTimer) {
    clearInterval(khqrVerifyTimer);
    khqrVerifyTimer = null;
  }
}

export function closeKhqrModal() {
  stopKhqrVerificationPolling();
  currentKhqrSession = null;
  document.getElementById('khqr-modal')?.classList.add('hidden');
}

// Runs after KHQR payment succeeds: creates the order via POST /api/orders, clears cart, and starts live tracking
async function finalizePaidOrder(md5) {
  if (isSubmittingOrder) return;
  isSubmittingOrder = true;

  try {
    stopKhqrVerificationPolling();
    const noteInput = document.getElementById('customer-note-input');
    const customerNote = noteInput ? noteInput.value.trim() : '';

    const items = getCart().map((item) => ({
      name: item.name,
      qty: item.qty,
      price: item.price,
    }));

    const createdOrder = await createOrder({
      table: getTableNumber(),
      items,
      paymentMd5: md5,
      customerNote,
    });

    clearCart();
    if (noteInput) {
      noteInput.value = '';
      updateCharCount(noteInput, document.getElementById('customer-note-count'), NOTE_MAX_LENGTH);
    }
    saveOrderToHistory(createdOrder);
    closeKhqrModal();
    closeCartDrawer();
    showToast(`Payment confirmed! Queue ${createdOrder.queueNumber} assigned.`, 'success');
    startOrderTracking(createdOrder);
  } catch (err) {
    showToast(`Order creation failed: ${err.message}`, 'error');
  } finally {
    isSubmittingOrder = false;
  }
}

// Requests a Bakong KHQR code for the cart total and polls every 3s to auto-confirm payment
async function loadKhqrCode() {
  const qrImg = document.getElementById('khqr-image');
  const qrLoading = document.getElementById('khqr-loading');
  const amountLabel = document.getElementById('khqr-amount-display');
  const accountLabel = document.getElementById('khqr-account-display');
  const md5Label = document.getElementById('khqr-md5-display');
  const modeStatus = document.getElementById('khqr-mode-status');

  stopKhqrVerificationPolling();
  if (qrImg) qrImg.classList.add('hidden');
  if (qrLoading) qrLoading.classList.remove('hidden');

  const totalUsd = getCartTotal();

  try {
    const session = await generateKhqrPayment({
      amount: totalUsd,
      currency: 'USD',
    });

    currentKhqrSession = session;

    if (qrImg) {
      qrImg.src = session.qrImageDataUrl;
      qrImg.classList.remove('hidden');
    }
    if (qrLoading) qrLoading.classList.add('hidden');

    if (amountLabel) {
      amountLabel.textContent = `$${Number(session.amount).toFixed(2)} USD`;
    }
    if (accountLabel) {
      accountLabel.textContent = session.accountNumber
        ? `${session.accountName} (${session.accountNumber})`
        : `${session.accountName} (${session.accountId})`;
    }
    if (md5Label) {
      md5Label.textContent = `MD5: ${session.md5}`;
    }
    if (modeStatus) {
      modeStatus.textContent = session.hasLiveToken
        ? 'Live Bakong API Verification Active — Scan with ABA / Bakong App'
        : 'Individual KHQR Ready — Scan with ABA or click Simulate Payment below';
    }

    // Poll Bakong verification every 3 seconds when a live token is active
    khqrVerifyTimer = setInterval(async () => {
      if (!currentKhqrSession) return;
      try {
        const res = await verifyKhqrPayment({
          md5: currentKhqrSession.md5,
          amount: currentKhqrSession.amount,
          currency: currentKhqrSession.currency,
          simulate: false,
        });
        if (res && res.responseCode === 0) {
          await finalizePaidOrder(currentKhqrSession.md5);
        }
      } catch {
        // Ignore transient verification poll errors
      }
    }, 3000);
  } catch (err) {
    if (qrLoading) qrLoading.classList.add('hidden');
    showToast(`Could not generate KHQR: ${err.message}`, 'error');
  }
}

/* ---------- Checkout form validation ---------- */

function validateTableField() {
  const input = document.getElementById('table-number-input');
  if (!input) return true;
  const raw = input.value.trim();
  const value = Number(raw);

  if (raw === '') {
    setFieldError(input, 'Table number is required.');
    return false;
  }
  if (!Number.isInteger(value)) {
    setFieldError(input, 'Table number must be a whole number.');
    return false;
  }
  if (value < 1 || value > 99) {
    setFieldError(input, 'Table number must be between 1 and 99.');
    return false;
  }
  setFieldError(input);
  return true;
}

function validateNoteField() {
  const input = document.getElementById('customer-note-input');
  if (!input) return true;
  const note = input.value.trim();

  if (note.length > NOTE_MAX_LENGTH) {
    setFieldError(input, `Note must be ${NOTE_MAX_LENGTH} characters or fewer (currently ${note.length}).`);
    return false;
  }
  if (/[<>]/.test(note)) {
    setFieldError(input, 'Note cannot contain < or > characters.');
    return false;
  }
  setFieldError(input);
  return true;
}

function validateCartNotEmpty() {
  const formError = document.getElementById('checkout-form-error');
  const isEmpty = getCart().length === 0;
  if (formError) {
    formError.textContent = isEmpty ? 'Your cart is empty — add at least one item before checking out.' : '';
    formError.classList.toggle('is-visible', isEmpty);
  }
  return !isEmpty;
}

// Validates the customer's cart, table number (1–99), and optional order note before opening KHQR payment
function validateCheckoutForm() {
  // Run every check (not short-circuit) so all errors show at once
  const results = [validateCartNotEmpty(), validateTableField(), validateNoteField()];
  return results.every(Boolean);
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  if (!validateCheckoutForm()) {
    document.querySelector('#checkout-form .is-invalid')?.focus();
    return;
  }

  setTableNumber(document.getElementById('table-number-input').value.trim());
  await openKhqrCheckoutModal();
}

export async function openKhqrCheckoutModal() {
  const items = getCart();
  if (items.length === 0) {
    showToast('Your cart is empty. Add items before checking out.', 'error');
    return;
  }

  // Ask Web Notification permission right when user clicks Checkout (valid user gesture).
  // Not awaited: if the customer ignores the browser prompt, the payment modal must still open.
  requestNotificationPermission();

  const summaryEl = document.getElementById('khqr-order-summary');
  if (summaryEl) {
    summaryEl.textContent = `Table #${getTableNumber()} • ${items
      .map((i) => `${i.qty}x ${i.name}`)
      .join(', ')}`;
  }

  document.getElementById('khqr-modal')?.classList.remove('hidden');
  await loadKhqrCode();
}

// Wires up customer checkout: form submit, live field validation, KHQR modal close, and demo payment simulation
export function initCheckoutEvents() {
  document.getElementById('checkout-form')?.addEventListener('submit', handleCheckoutSubmit);

  // Live feedback: re-validate a field once it has shown an error, and keep the counter updated
  const tableInput = document.getElementById('table-number-input');
  tableInput?.addEventListener('input', () => {
    if (tableInput.classList.contains('is-invalid')) validateTableField();
  });
  tableInput?.addEventListener('blur', validateTableField);

  const noteInput = document.getElementById('customer-note-input');
  const noteCounter = document.getElementById('customer-note-count');
  noteInput?.addEventListener('input', () => {
    updateCharCount(noteInput, noteCounter, NOTE_MAX_LENGTH);
    if (noteInput.classList.contains('is-invalid') || noteInput.value.length > NOTE_MAX_LENGTH) {
      validateNoteField();
    }
  });
  updateCharCount(noteInput, noteCounter, NOTE_MAX_LENGTH);

  document
    .getElementById('close-khqr-btn')
    ?.addEventListener('click', closeKhqrModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentKhqrSession) closeKhqrModal();
  });

  document
    .getElementById('simulate-khqr-pay-btn')
    ?.addEventListener('click', async () => {
      if (!currentKhqrSession) {
        showToast('Please wait for KHQR to finish generating.', 'error');
        return;
      }

      const btn = document.getElementById('simulate-khqr-pay-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Verifying Bakong Payment...';
      }

      try {
        const result = await verifyKhqrPayment({
          md5: currentKhqrSession.md5,
          amount: currentKhqrSession.amount,
          currency: currentKhqrSession.currency,
          simulate: true,
        });

        if (result && result.responseCode === 0) {
          await finalizePaidOrder(currentKhqrSession.md5);
        } else {
          showToast('Payment not yet confirmed.', 'error');
        }
      } catch (err) {
        showToast(`Verification error: ${err.message}`, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Simulate Payment Confirmed (Demo)';
        }
      }
    });
}
