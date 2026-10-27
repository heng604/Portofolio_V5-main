// Runs the Express API and Vite together (cross-platform, no extra dependency).
import { spawn } from 'node:child_process';
const run = (args) => spawn(process.execPath, args, { stdio: 'inherit' });
const api = run(['--watch', 'server/index.js']);
const web = run(['node_modules/vite/bin/vite.js']);
const stop = () => { api.kill(); web.kill(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
api.on('exit', (c) => { if (c) { web.kill(); process.exit(c); } });
web.on('exit', () => { api.kill(); process.exit(0); });
