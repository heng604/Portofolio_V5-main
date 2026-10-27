import express from 'express';
import cors from 'cors';
import { config } from './env.js';
import bakongRouter from './routes/bakong.js';
import adminRouter from './routes/admin.js';

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/bakong', bakongRouter);
app.use('/api/admin', adminRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', siteUrl: config.siteUrl, timestamp: new Date() });
});

// Always return JSON for unhandled 404 API calls instead of HTML web page
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Unhandled Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

app.listen(config.port, () => {
  console.log(`Server running on ${config.siteUrl} (port ${config.port})`);
});
