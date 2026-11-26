const crypto = require('crypto');
const QRCode = require('qrcode');
const { BakongKHQR, IndividualInfo, khqrData } = require('bakong-khqr');
const crc16 = require('bakong-khqr/src/helper/crc16');

// Official NBC Bakong endpoint used to check if a KHQR payment was received
const BAKONG_VERIFY_URL = 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5';

/**
 * Generates a real Individual Bakong KHQR payload and scannable QR image
 * for the exact total food amount using your personal ABA/Bakong account.
 */
async function generateKhqr({ amount, currency = 'USD' }) {
  const accountId = (process.env.BAKONG_ACCOUNT_ID || '').trim();
  const accountNumber = (process.env.ABA_ACCOUNT_NUMBER || '').replace(/\s+/g, '');
  const acquiringBank = (process.env.BAKONG_ACQUIRING_BANK || 'ABA Bank').trim();
  const accountName = (process.env.BAKONG_ACCOUNT_NAME || '').trim();
  const merchantCity = (process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh').trim();
  const abaP2pTag = (process.env.ABA_P2P_TAG || '').trim();

  if (!accountId || !accountName) {
    throw new Error('Missing BAKONG_ACCOUNT_ID or BAKONG_ACCOUNT_NAME in .env');
  }

  // Format amount to match the selected currency (2 decimals for USD, whole number for KHR)
  const finalCurrency = currency.toUpperCase() === 'KHR' ? 'KHR' : 'USD';
  const finalAmount =
    finalCurrency === 'KHR'
      ? Math.round(Number(amount))
      : Number(Number(amount).toFixed(2));

  const khqrCurrency =
    finalCurrency === 'KHR' ? khqrData.currency.khr : khqrData.currency.usd;

  // Build Bakong Individual KHQR info (expires in 15 minutes)
  const info = new IndividualInfo(accountId, accountName, merchantCity, {
    accountInformation: accountNumber || undefined,
    acquiringBank: acquiringBank || undefined,
    currency: khqrCurrency,
    amount: finalAmount,
    expirationTimestamp: Date.now() + 15 * 60 * 1000,
  });

  const khqr = new BakongKHQR();
  const result = khqr.generateIndividual(info);

  if (!result || !result.status || result.status.code !== 0 || !result.data) {
    throw new Error(result?.status?.message || 'Failed to generate Bakong KHQR');
  }

  let qrString = result.data.qr;
  let md5 = result.data.md5;

  // Include ABA's P2P Tag 40 (if configured) and recalculate CRC-16 + MD5
  if (abaP2pTag) {
    const withoutCrc = qrString.slice(0, -4).replace('52045999', abaP2pTag + '52045999');
    qrString = withoutCrc + crc16(withoutCrc);
    md5 = crypto.createHash('md5').update(qrString).digest('hex');
  }

  // Convert the EMVCo KHQR string into a PNG image Data URL for <img src="...">
  const qrImageDataUrl = await QRCode.toDataURL(qrString, {
    width: 320,
    margin: 2,
  });

  return {
    qrString,
    qrImageDataUrl,
    md5,
    amount: finalAmount,
    currency: finalCurrency,
    accountName,
    accountId,
    accountNumber,
    hasLiveToken: Boolean(process.env.BAKONG_DEV_TOKEN && process.env.BAKONG_DEV_TOKEN.trim()),
  };
}

/**
 * Checks whether a Bakong KHQR payment (identified by its MD5 hash) is completed.
 * Uses the NBC Bakong API when BAKONG_DEV_TOKEN is set in .env,
 * or returns confirmed immediately when forceSimulate is true.
 */
async function verifyTransactionByMd5({ md5, amount, currency = 'USD', forceSimulate = false }) {
  if (forceSimulate) {
    return {
      responseCode: 0,
      data: {
        md5,
        amount: Number(amount || 0),
        currency,
      },
    };
  }

  const token = (process.env.BAKONG_DEV_TOKEN || '').trim();
  if (!token) {
    return {
      responseCode: 1,
      data: null,
      message: 'Waiting for payment...',
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
      return {
        responseCode: 0,
        data: payload.data,
      };
    }

    return {
      responseCode: payload?.responseCode ?? 1,
      data: null,
      message: payload?.responseMessage || 'Waiting for payment...',
    };
  } catch (err) {
    console.error('Bakong verification request error:', err.message);
    return {
      responseCode: 1,
      data: null,
      message: 'Unable to reach Bakong API.',
    };
  }
}

module.exports = {
  generateKhqr,
  verifyTransactionByMd5,
};
