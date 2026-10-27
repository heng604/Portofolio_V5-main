import axios from 'axios';
import { config } from '../env.js';

/**
 * Generate Bakong KHQR Code safely with proper defaults and robust error handling
 */
export async function generateBakongQR({
  accountId = config.bakongAccountId,
  merchantName = config.bakongMerchantName,
  merchantCity = config.bakongMerchantCity,
  amount,
  currency = 'USD',
  storeLabel = 'Main Store',
  terminalLabel = 'Cashier 1'
}) {
  try {
    if (!accountId) {
      throw new Error('Bakong Account ID is missing. Check BAKONG_ACCOUNT_ID in .env file.');
    }
    if (!config.bakongToken) {
      throw new Error('Bakong API Token is missing. Check BAKONG_TOKEN in .env file.');
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Invalid transaction amount provided.');
    }

    const payload = {
      bakongAccountId: accountId,
      merchantName: merchantName || 'My Store',
      merchantCity: merchantCity || 'Phnom Penh',
      amount: currency === 'KHR' ? Math.round(numericAmount) : numericAmount,
      currency: currency.toUpperCase() === 'KHR' ? 'KHR' : 'USD',
      storeLabel: storeLabel || 'Main Store',
      terminalLabel: terminalLabel || 'Cashier 1'
    };

    const response = await axios.post(
      `${config.bakongApiUrl}/generate_khqr`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.bakongToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000 // 10s timeout to prevent hanging requests
      }
    );

    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    console.error('Bakong QR Generation Failed:', errorMsg);
    throw new Error(`Bakong QR Error: ${errorMsg}`);
  }
}

/**
 * Check Transaction Status by MD5 Hash safely
 */
export async function checkBakongTransaction(md5Hash) {
  try {
    if (!md5Hash) {
      throw new Error('MD5 hash parameter is required.');
    }

    const response = await axios.post(
      `${config.bakongApiUrl}/check_transaction_by_md5`,
      { md5: md5Hash },
      {
        headers: {
          Authorization: `Bearer ${config.bakongToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000
      }
    );

    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    console.error('Bakong Check Tx Failed:', errorMsg);
    throw new Error(`Bakong Check Tx Error: ${errorMsg}`);
  }
}
