const crypto = require('crypto');
const QRCode = require('qrcode');
const { BakongKHQR, IndividualInfo, khqrData } = require('bakong-khqr');

const BAKONG_VERIFY_URL = 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5';

// In-memory store for generated KHQR sessions and confirmed transactions
const generatedTransactions = new Map();
const paidTransactions = new Set();

/**
 * Builds a deterministic fallback KHQR-style payload if the account config cannot be encoded by bakong-khqr.
 */
function createFallbackQr({ accountId, accountName, amount, currency }) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const qrString = `00020101021229180014${accountId}5303${currency === 'KHR' ? '116' : '840'}5404${amount}5802KH59${accountName}6304MOCK`;
  const md5 = crypto.createHash('md5').update(`${qrString}:${nonce}`).digest('hex');
  return { qrString, md5 };
}

/**
 * Generates a real Individual Bakong KHQR payload + scannable QR data URL for a Personal ABA/Bakong account.
 */
async function generateKhqr({ amount, currency = 'USD', useDemoAmount = false }) {
  const accountId = (process.env.BAKONG_ACCOUNT_ID || 'chan_panha@aba').trim();
  const accountName = (process.env.BAKONG_ACCOUNT_NAME || 'CHAN PANHA').trim();
  const merchantCity = (process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh').trim();

  const demoKhr = Number(process.env.DEMO_TEST_AMOUNT_KHR || 100);
  const finalCurrency = useDemoAmount ? 'KHR' : currency.toUpperCase() === 'KHR' ? 'KHR' : 'USD';
  const rawAmount = useDemoAmount ? demoKhr : Number(amount);
  const finalAmount =
    finalCurrency === 'KHR'
      ? Math.max(100, Math.round(rawAmount))
      : Number(Math.max(0.01, rawAmount).toFixed(2));

  let qrString = '';
  let md5 = '';
  let isMockFallback = false;

  try {
    const khqrCurrency =
      finalCurrency === 'KHR' ? khqrData.currency.khr : khqrData.currency.usd;

    const info = new IndividualInfo(accountId, accountName, merchantCity, {
      currency: khqrCurrency,
      amount: finalAmount,
      expirationTimestamp: Date.now() + 15 * 60 * 1000,
    });

    const khqr = new BakongKHQR();
    const result = khqr.generateIndividual(info);

    if (result && result.status && result.status.code === 0 && result.data) {
      qrString = result.data.qr;
      md5 = result.data.md5;
    } else {
      throw new Error(result?.status?.message || 'KHQR generation rejected');
    }
  } catch (err) {
    console.warn('bakong-khqr fallback triggered:', err.message);
    isMockFallback = true;
    const fallback = createFallbackQr({
      accountId,
      accountName,
      amount: finalAmount,
      currency: finalCurrency,
    });
    qrString = fallback.qrString;
    md5 = fallback.md5;
  }

  const qrImageDataUrl = await QRCode.toDataURL(qrString, {
    width: 320,
    margin: 2,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
  });

  generatedTransactions.set(md5, {
    amount: finalAmount,
    currency: finalCurrency,
    createdAt: Date.now(),
  });

  return {
    qrString,
    qrImageDataUrl,
    md5,
    amount: finalAmount,
    currency: finalCurrency,
    accountName,
    accountId,
    isDemoAmount: Boolean(useDemoAmount),
    isMockFallback,
    hasLiveToken: Boolean(process.env.BAKONG_DEV_TOKEN && process.env.BAKONG_DEV_TOKEN.trim()),
  };
}

/**
 * Verifies payment status by MD5 via NBC Bakong API (if BAKONG_DEV_TOKEN is configured)
 * or confirms simulation/mock mode while returning the exact Bakong response contract.
 */
async function verifyTransactionByMd5({ md5, amount, currency, forceSimulate = false }) {
  const recorded = generatedTransactions.get(md5);
  const resolvedAmount = amount !== undefined ? Number(amount) : recorded?.amount ?? 0;
  const resolvedCurrency = currency || recorded?.currency || 'USD';

  if (forceSimulate || paidTransactions.has(md5)) {
    paidTransactions.add(md5);
    return {
      responseCode: 0,
      data: {
        md5,
        amount: resolvedAmount,
        currency: resolvedCurrency,
      },
    };
  }

  const token = (process.env.BAKONG_DEV_TOKEN || '').trim();
  if (!token) {
    return {
      responseCode: 1,
      data: null,
      message: 'Awaiting payment confirmation (configure BAKONG_DEV_TOKEN or use Demo Simulate).',
    };
  }

  try {
    const response = await fetch(BAKONG_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ md5 }),
    });

    const payload = await response.json();

    if (payload && payload.responseCode === 0 && payload.data) {
      paidTransactions.add(md5);
      return {
        responseCode: 0,
        data: {
          md5: payload.data.md5 || md5,
          amount: Number(payload.data.amount ?? resolvedAmount),
          currency: payload.data.currency || resolvedCurrency,
        },
      };
    }

    return {
      responseCode: payload?.responseCode ?? 1,
      data: null,
      message: payload?.responseMessage || 'Transaction pending.',
    };
  } catch (err) {
    console.error('Bakong verification request error:', err.message);
    return {
      responseCode: 1,
      data: null,
      message: 'Unable to reach Bakong API; retry or use Demo Simulate.',
    };
  }
}

module.exports = {
  generateKhqr,
  verifyTransactionByMd5,
};
