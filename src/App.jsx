import { useCallback, useEffect, useRef, useState } from 'react';

import useLocalStorage from './hooks/useLocalStorage.js';
import {
  CHIAVE_STATISTICHE, statisticheVuote, registraEsito,
  puoAvanzare, avanzaLivello, chiudiPartita, cambiaDifficolta,
  normalizzaStatistiche, registraSessioneRapida, recordRapido,
} from './utils/statistiche.js';

import Home from './components/Home.jsx';
import Partita from './components/Partita.jsx';
import PartitaRapida from './components/PartitaRapida.jsx';
import Riepilogo from './components/Riepilogo.jsx';
import RiepilogoRapido from './components/RiepilogoRapido.jsx';
import Statistiche from './components/Statistiche.jsx';

export default function App() {
  const [statistiche, setStatistiche] = useLocalStorage(
    CHIAVE_STATISTICHE, statisticheVuote(), normalizzaStatistiche,
  );
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
      return esito.corretta && esito.perLivello !== false && puoAvanzare(aggiornate) ? avanzaLivello(aggiornate) : aggiornate;
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

  // Il record si legge prima di registrare la sessione: confrontarla con sé
  // stessa direbbe sempre «nuovo record» o sempre «pari».
  const concludiRapida = esitoFinale => {
    setRiepilogo({
      ...esitoFinale,
      recordPrecedente: recordRapido(statistiche, esitoFinale.ritmo, esitoFinale.prezzi),
    });
    setStatistiche(precedenti => registraSessioneRapida(precedenti, esitoFinale));
    setSchermata('riepilogo');
  };

  const azzera = () => {
    if (!window.confirm('Cancello punteggi, livelli e statistiche?')) return;
    setStatistiche(statisticheVuote());
  };

  const rapida = impostazioni?.modalita === 'rapido';

  if (schermata === 'partita' && rapida) {
    return (
      <PartitaRapida
        key={sessione}
        ritmo={impostazioni.ritmo}
        prezzi={impostazioni.prezzi}
        onFine={concludiRapida}
        onEsci={() => setSchermata('home')}
      />
    );
  }

  if (schermata === 'riepilogo' && rapida) {
    return (
      <RiepilogoRapido
        riepilogo={riepilogo}
        recordPrecedente={riepilogo.recordPrecedente}
        onRigioca={() => avvia(impostazioni)}
        onEsci={() => setSchermata('home')}
      />
    );
  }

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
