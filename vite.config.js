import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

/*
 * Su GitHub Pages il sito non sta alla radice del dominio ma sotto il nome del
 * repository, quindi ogni percorso assoluto va prefissato. Sta in una variabile
 * d'ambiente perche' cambia con l'hosting: alla radice (dominio proprio,
 * Netlify, Cloudflare) basta BASE_PATH=/ e non si tocca altro.
 */
const base = process.env.BASE_PATH ?? '/cassa/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // Registriamo il service worker a mano in src/main.jsx, come in turni:
      // cosi' l'aggiornamento resta sotto controllo e non serve l'auto-inject.
      injectRegister: null,
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Cassa - allenati a dare il resto',
        short_name: 'Cassa',
        description: 'Gioco di allenamento per la cassa: contare i contanti e dare il resto giusto, in fretta.',
        lang: 'it',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
