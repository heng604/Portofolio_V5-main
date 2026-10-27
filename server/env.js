import dotenv from 'dotenv';
dotenv.config();

function formatSiteUrl(url) {
  if (!url) return 'http://localhost:5000';
  let formatted = url.trim();
  if (!/^https?:\/\//i.test(formatted)) {
    formatted = `http://${formatted}`;
  }
  return formatted.replace(/\/+$/, '');
}

export const config = {
  port: process.env.PORT || 5000,
  siteUrl: formatSiteUrl(process.env.SITE_URL),
  bakongApiUrl: process.env.BAKONG_API_URL || 'https://api-bakong.nbc.gov.kh/v1',
  bakongToken: process.env.BAKONG_TOKEN || '',
  bakongAccountId: process.env.BAKONG_ACCOUNT_ID || '',
  bakongMerchantName: process.env.BAKONG_MERCHANT_NAME || 'Portfolio Tip Jar',
  bakongMerchantCity: process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh',
};
