import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { creaRng, generaTransazione } from '../utils/generatore.js';
import {
  CLIENTI_PER_SESSIONE_RAPIDA, livelloRapido, ritmo as ritmoDi,
  secondiPerCliente, esitoRapido, riassuntoRapido,
} from '../utils/lampo.js';

import BarraStato from './BarraStato.jsx';
import Esercizio from './Esercizi.jsx';

/**
 * Resto rapido: un cliente dopo l'altro, pochi secondi a testa. Allo scadere
 * del tempo si consegna quello che c'è nel vassoio, anche se è vuoto — al
 * banco il cliente non aspetta che tu finisca.
 *
 * Durante la sessione non trapela niente su com'è andata: né un esito, né un
 * contatore di risposte giuste, né una vibrazione diversa. Al banco nessuno ti
 * dice che hai sbagliato il resto; lo scopri alla chiusura, quando la cassa
 * non torna. Il riepilogo finale è l'unico momento in cui si sa.
 */
export default function PartitaRapida({ ritmo, prezzi, onFine, onEsci }) {
  const livello = useMemo(() => livelloRapido(prezzi), [prezzi]);
  const rng = useRef(creaRng(Date.now()));

  const [transazione, setTransazione] = useState(() => generaTransazione(livello, { rng: rng.current }));
  const [risposta, setRisposta] = useState({ pezzi: {}, dichiarazione: null });

  // Gli esiti stanno in un ref: non devono mai finire a schermo prima della fine.
  const esiti = useRef([]);
  const inizioRound = useRef(performance.now());
  // Un cliente si consegna una volta sola: il tocco su Consegna e lo scadere
  // del tempo possono arrivare insieme, prima che React ridisegni.
  const consegnato = useRef(null);
  const rispostaRef = useRef(risposta);
  rispostaRef.current = risposta;

  const secondi = secondiPerCliente(ritmo, transazione);

  const consegna = useCallback(scaduto => {
    if (consegnato.current === transazione.id) return;
    consegnato.current = transazione.id;

    esiti.current = [...esiti.current, esitoRapido(transazione, rispostaRef.current.pezzi, {
      msImpiegati: performance.now() - inizioRound.current,
      scaduto,
    })];
    vibra();

    if (esiti.current.length >= CLIENTI_PER_SESSIONE_RAPIDA) {
      onFine({ ritmo, prezzi, esiti: esiti.current, riassunto: riassuntoRapido(esiti.current) });
      return;
    }
    setTransazione(generaTransazione(livello, { rng: rng.current }));
    setRisposta({ pezzi: {}, dichiarazione: null });
    inizioRound.current = performance.now();
  }, [transazione, livello, onFine, ritmo, prezzi]);

  // Il tempo del cliente: allo scadere si consegna quello che hai in mano.
  useEffect(() => {
    const id = setTimeout(() => consegna(true), secondi * 1000);
    return () => clearTimeout(id);
  }, [secondi, consegna]);

  // Invio consegna.
  const invio = useRef(null);
  invio.current = () => consegna(false);
  useEffect(() => {
    const suTasto = evento => {
      if (evento.key !== 'Enter' || evento.repeat) return;
      evento.preventDefault();
      invio.current();
    };
    window.addEventListener('keydown', suTasto);
    return () => window.removeEventListener('keydown', suTasto);
  }, []);

  const cliente = Math.min(esiti.current.length + 1, CLIENTI_PER_SESSIONE_RAPIDA);

  return (
    <div className="app">
      <BarraStato
        titolo={`Ritmo ${ritmoDi(ritmo).nome.toLowerCase()}`}
        sottotitolo="Resto rapido"
        punteggio={null}
        progresso={`${cliente}/${CLIENTI_PER_SESSIONE_RAPIDA}`}
        secondiTimer={secondi}
        chiaveRound={transazione.id}
        onEsci={onEsci}
      />

      <main className="scena">
        <Esercizio
          key={transazione.id}
          transazione={transazione}
          risposta={risposta}
          onRisposta={setRisposta}
          cassetto={null}
          rapido
        />
      </main>

      <div className="azioni">
        <button type="button" className="pulsante pulsante--principale" onClick={() => consegna(false)}>
          Consegna il resto
        </button>
      </div>
    </div>
  );
}

/** La stessa per ogni consegna: una vibrazione diversa per gli errori sarebbe un esito. */
function vibra() {
  try {
    navigator.vibrate?.(15);
  } catch {
    // Non disponibile: non è un errore di gioco.
  }
}
