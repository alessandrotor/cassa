import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Il service worker lo registriamo a mano (injectRegister: null nella config)
// cosi' resta chiaro dove e quando l'app decide di andare offline.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // BASE_URL segue la configurazione di build: alla radice vale '/', su
    // GitHub Pages vale '/cassa/'. Scriverlo a mano romperebbe uno dei due.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Senza service worker l'app funziona lo stesso: perde solo l'offline.
    });
  });
}
