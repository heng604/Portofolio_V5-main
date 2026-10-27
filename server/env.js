import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  bakongApiUrl: process.env.BAKONG_API_URL || 'https://api-bakong.nbc.gov.kh/v1',
  bakongToken: process.env.BAKONG_TOKEN || '',
  bakongAccountId: process.env.BAKONG_ACCOUNT_ID || '',
  bakongMerchantName: process.env.BAKONG_MERCHANT_NAME || 'My Store',
  bakongMerchantCity: process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh',
};
