// Vercel serverless entry: the same Express app as `npm start`, mounted for /api/*.
// (vercel.json rewrites /api/(.*) to this file; Express still sees the original URL.)
import app from '../server/app.js';
export default app;
