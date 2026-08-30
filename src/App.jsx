import { useCallback, useEffect, useRef, useState } from 'react';

import useLocalStorage from './hooks/useLocalStorage.js';
import {
  CHIAVE_STATISTICHE, statisticheVuote, registraEsito,
  puoAvanzare, avanzaLivello, chiudiPartita, cambiaDifficolta,
} from './utils/statistiche.js';

import Home from './components/Home.jsx';
import Partita from './components/Partita.jsx';
import Riepilogo from './components/Riepilogo.jsx';
import Statistiche from './components/Statistiche.jsx';

export default function App() {
  const [statistiche, setStatistiche] = useLocalStorage(CHIAVE_STATISTICHE, statisticheVuote());
  const [schermata, setSchermata] = useState('home');
  const [impostazioni, setImpostazioni] = useState(null);
  const [riepilogo, setRiepilogo] = useState(null);
  const [salitoDiLivello, setSalitoDiLivello] = useState(false);
  const [sessione, setSessione] = useState(0);

  /**
   * Ogni round finito passa di qui. L'avanzamento di livello si decide sulle
   * statistiche appena aggiornate, non su quelle del render precedente.
   */
  const registra = useCallback(esito => {
    setStatistiche(precedenti => {
      const aggiornate = registraEsito(precedenti, esito);
      // Si sale solo su una risposta giusta. Con la regola a finestra la soglia
      // puo' risultare gia' soddisfatta anche dopo un errore (quello vecchio e'
      // uscito dalla finestra), e salire di livello sbagliando sarebbe assurdo.
      return esito.corretta && puoAvanzare(aggiornate) ? avanzaLivello(aggiornate) : aggiornate;
    });
  }, [setStatistiche]);

  // Il "livello sbloccato" si osserva dal risultato, non si annuncia dentro
  // l'updater: in StrictMode quello puo' essere eseguito due volte.
  const livelloPrecedente = useRef(statistiche.livelloRaggiunto);
  useEffect(() => {
    if (statistiche.livelloRaggiunto > livelloPrecedente.current) setSalitoDiLivello(true);
    livelloPrecedente.current = statistiche.livelloRaggiunto;
  }, [statistiche.livelloRaggiunto]);

  const avvia = opzioni => {
    setImpostazioni(opzioni);
    setSalitoDiLivello(false);
    setSessione(n => n + 1);
    setSchermata('partita');
  };

  const concludiPartita = esitoFinale => {
    setRiepilogo(esitoFinale);
    setStatistiche(precedenti => chiudiPartita(precedenti, {
      punteggio: esitoFinale.punteggio,
      streakMassima: esitoFinale.streakMassima,
    }));
    setSchermata('riepilogo');
  };

  const azzera = () => {
    if (!window.confirm('Cancello punteggi, livelli e statistiche?')) return;
    setStatistiche(statisticheVuote());
  };

  if (schermata === 'partita') {
    return (
      <Partita
        key={sessione}
        modalita={impostazioni.modalita}
        numeroLivello={impostazioni.numeroLivello}
        eserciziScelti={impostazioni.eserciziScelti}
        obiettivo={impostazioni.obiettivo}
        onEsito={registra}
        onFine={concludiPartita}
        onEsci={() => setSchermata('home')}
      />
    );
  }

  if (schermata === 'riepilogo') {
    return (
      <Riepilogo
        riepilogo={riepilogo}
        salitoDiLivello={salitoDiLivello}
        onRigioca={() => avvia(impostazioni)}
        onEsci={() => setSchermata('home')}
      />
    );
  }

  if (schermata === 'statistiche') {
    return (
      <Statistiche
        statistiche={statistiche}
        onAzzera={azzera}
        onEsci={() => setSchermata('home')}
      />
    );
  }

  return (
    <Home
      key={statistiche.livelloRaggiunto}
      statistiche={statistiche}
      onAvvia={avvia}
      onStatistiche={() => setSchermata('statistiche')}
      onDifficolta={chiave => setStatistiche(precedenti => cambiaDifficolta(precedenti, chiave))}
    />
  );
}
