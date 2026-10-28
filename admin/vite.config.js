// Separate build of the admin dashboard. Output: dist/admin (served at /admin).
//   dev:   npm run dev:admin   -> http://localhost:5174/admin/
//   build: npm run build:admin
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

export default defineConfig(({ command }) => ({
  root: here,
  base: '/admin/',
  envDir: root, // reads VITE_SUPABASE_* from the project .env
  publicDir: command === 'serve' ? path.resolve(root, 'public') : false, // the public build already ships these files
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss(path.resolve(root, 'tailwind.config.js')), autoprefixer()] } },
  resolve: { alias: { '@portfolio': path.resolve(root, 'src') } }, // read-only reuse: data, i18n dictionary, TipJar
  server: { port: 5174, fs: { allow: [root] }, proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false } } },
  build: { outDir: path.resolve(root, 'dist/admin'), emptyOutDir: true, sourcemap: false },
}));
