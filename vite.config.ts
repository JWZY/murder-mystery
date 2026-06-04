import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// On GitHub Pages "project" sites the app is served from /<repo>/, so the build
// needs a matching base path. The deploy workflow sets VITE_BASE to "/<repo>/".
// Locally (and on user/org root sites) it stays "/".
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [react()],
});
