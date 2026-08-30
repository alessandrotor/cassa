import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/*
 * Service worker registrato a mano (injectRegister: null nella config), così
 * resta scritto qui cosa succede quando esce una versione nuova.
 *
 * Senza la ricarica qui sotto l'app resta indietro di un avvio: il service
 * worker scarica la versione nuova in sottofondo e la attiva, ma la pagina
 * gira già col codice vecchio e nessuno la aggiorna. Chi apre l'app continua a
 * vedere la versione precedente finché non la riapre una seconda volta — ed è
 * esattamente il modo in cui una correzione pubblicata sembra non esserci.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Al primissimo avvio il controller non c'è ancora: quando arriva non è un
  // aggiornamento, è l'installazione, e ricaricare sarebbe solo un lampo inutile.
  const primaInstallazione = !navigator.serviceWorker.controller;
  let ricaricando = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (primaInstallazione || ricaricando) return;
    ricaricando = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    // BASE_URL segue la configurazione di build: alla radice vale '/', su
    // GitHub Pages vale '/cassa/'. Scriverlo a mano romperebbe uno dei due.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registrazione => {
      // Un'app installata spesso viene ripresa invece che riaperta: senza questo
      // controllo potrebbe restare aperta per giorni su una versione vecchia.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registrazione.update().catch(() => {});
      });
    }).catch(() => {
      // Senza service worker l'app funziona lo stesso: perde solo l'offline.
    });
  });
}
