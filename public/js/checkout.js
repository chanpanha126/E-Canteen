/**
 * Teammate 2 Ownership: Bakong KHQR Checkout Modal, Payment Verification, & Order Submission
 */

import { generateKhqrPayment, verifyKhqrPayment, createOrder } from './api.js';
import {
  getCart,
  getCartTotal,
  getTableNumber,
  clearCart,
  closeCartDrawer,
  saveOrderToHistory,
  showToast,
} from './cart.js';
import { requestNotificationPermission, startOrderTracking } from './tracking.js';

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
    if (noteInput) noteInput.value = '';
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

export async function openKhqrCheckoutModal() {
  const items = getCart();
  if (items.length === 0) {
    showToast('Your cart is empty. Add items before checking out.', 'error');
    return;
  }

  // Ask Web Notification permission right when user clicks Checkout (valid user gesture)
  await requestNotificationPermission();

  const summaryEl = document.getElementById('khqr-order-summary');
  if (summaryEl) {
    summaryEl.textContent = `Table #${getTableNumber()} • ${items
      .map((i) => `${i.qty}x ${i.name}`)
      .join(', ')}`;
  }

  document.getElementById('khqr-modal')?.classList.remove('hidden');
  await loadKhqrCode();
}

export function initCheckoutEvents() {
  document
    .getElementById('proceed-checkout-btn')
    ?.addEventListener('click', openKhqrCheckoutModal);

  document
    .getElementById('close-khqr-btn')
    ?.addEventListener('click', closeKhqrModal);

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
          btn.textContent = '✓ Simulate Payment Confirmed (Demo)';
        }
      }
    });
}
