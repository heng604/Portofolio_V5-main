import express from 'express';
import { generateBakongQR, checkBakongTransaction } from '../lib/bakong.js';

const router = express.Router();

router.post('/generate-qr', async (req, res) => {
  try {
    const { amount, currency, storeLabel, merchantName, merchantCity } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, error: 'Amount is required' });
    }

    const qrData = await generateBakongQR({
      amount,
      currency,
      storeLabel,
      merchantName,
      merchantCity
    });

    return res.status(200).json({ success: true, data: qrData });
  } catch (error) {
    console.error('[Bakong Route Error - /generate-qr]:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/check-status', async (req, res) => {
  try {
    const { md5 } = req.body;
    if (!md5) {
      return res.status(400).json({ success: false, error: 'MD5 hash is required' });
    }

    const result = await checkBakongTransaction(md5);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[Bakong Route Error - /check-status]:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
