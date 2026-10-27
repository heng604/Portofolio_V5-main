import axios from 'axios';
import { config } from '../env.js';

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
      throw new Error('Bakong Account ID is missing. Please set BAKONG_ACCOUNT_ID in server/.env');
    }
    if (!config.bakongToken) {
      throw new Error('Bakong API Token is missing. Please set BAKONG_TOKEN in server/.env');
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Invalid donation amount provided.');
    }

    const payload = {
      bakongAccountId: accountId,
      merchantName: merchantName || 'Portfolio Tip Jar',
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
        timeout: 10000
      }
    );

    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    console.error('Bakong QR Generation Error:', errorMsg);
    throw new Error(errorMsg);
  }
}

export async function checkBakongTransaction(md5Hash) {
  try {
    if (!md5Hash) {
      throw new Error('MD5 hash is required.');
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
    console.error('Bakong Check Tx Error:', errorMsg);
    throw new Error(errorMsg);
  }
}
