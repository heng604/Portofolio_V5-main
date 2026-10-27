import express from 'express';
import cors from 'cors';
import { config } from './env.js';
import bakongRouter from './routes/bakong.js';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/bakong', bakongRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Global error handler to stop server crashes
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

app.listen(config.port, () => {
  console.log(`pf server listening on port ${config.port}`);
});
