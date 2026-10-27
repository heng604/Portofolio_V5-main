import express from 'express';
import { config } from '../env.js';

const router = express.Router();

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate siteUrl format
    if (!config.siteUrl || !config.siteUrl.startsWith('http')) {
      return res.status(500).json({
        code: 500,
        error_code: "invalid_site_url",
        msg: "site url is improperly formatted. Must include http:// or https:// in server/.env",
      });
    }

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    // Mock successful authentication response
    return res.status(200).json({
      success: true,
      site_url: config.siteUrl,
      user: { username, role: 'admin' },
      token: 'admin-session-token-12345'
    });
  } catch (error) {
    return res.status(500).json({
      code: 500,
      error_code: "unexpected_failure",
      msg: error.message
    });
  }
});

export default router;
