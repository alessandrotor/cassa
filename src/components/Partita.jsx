import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FONDO_CASSA_INIZIALE } from '../data/valuta.js';
import { livello as livelloDi, livelloLibero, ESERCIZI } from '../data/livelli.js';
import { creaRng, generaTransazione } from '../utils/generatore.js';
import { valutaRisposta } from '../utils/valutazione.js';
import { calcolaPunti } from '../utils/punteggio.js';
import { creaCassetto, registraTransazione, totaleCassetto, tagliEsauriti, chiusuraCassa } from '../utils/cassetto.js';
import { etichettaTaglio } from '../data/valuta.js';

import BarraStato, { StatoCassetto } from './BarraStato.jsx';
import Esercizio, { rispostaIniziale, rispostaPronta } from './Esercizi.jsx';
import Feedback from './Feedback.jsx';

/** Un turno di cassa dura quanto una coda vera, non quanto una partita infinita. */
export const CLIENTI_PER_TURNO = 15;

export default function Partita({ modalita, numeroLivello, eserciziScelti, onEsito, onFine, onEsci }) {
  const turno = modalita === 'turno';

  const livello = useMemo(() => {
    if (turno) return livelloLibero(eserciziScelti ?? Object.keys(ESERCIZI), 0);
    const base = livelloDi(numeroLivello);
    if (!eserciziScelti || eserciziScelti.length === 0) return base;
    // L'allenamento mirato resta dentro il livello: cambia il mazzo, non la difficoltà.
    const filtrati = base.esercizi.filter(e => eserciziScelti.includes(e));
    return filtrati.length > 0 ? { ...base, esercizi: filtrati } : base;
  }, [turno, numeroLivello, eserciziScelti]);

  const rng = useRef(creaRng(Date.now()));
  const cassettoIniziale = useRef(turno ? creaCassetto(FONDO_CASSA_INIZIALE) : null);

  const [cassetto, setCassetto] = useState(cassettoIniziale.current);
  const [transazione, setTransazione] = useState(() =>
    generaTransazione(livello, { cassetto: cassettoIniziale.current, rng: rng.current }));
  const [risposta, setRisposta] = useState(() => rispostaIniziale(transazione.tipoEsercizio));
  const [esito, setEsito] = useState(null);
  const [premio, setPremio] = useState({ punti: 0, dettaglio: [] });

  const [punteggio, setPunteggio] = useState(0);
  const [streak, setStreak] = useState(0);
  const [streakMassima, setStreakMassima] = useState(0);
  const [indice, setIndice] = useState(1);
  const [incassoAtteso, setIncassoAtteso] = useState(0);
  const [corrette, setCorrette] = useState(0);
  const [tempi, setTempi] = useState([]);

  const inizioRound = useRef(performance.now());
  // Il timer legge la risposta da un ref: se dipendesse dallo stato, ogni tocco
  // sul tastierino farebbe ripartire il conto alla rovescia.
  const rispostaRef = useRef(risposta);
  rispostaRef.current = risposta;

  const inFeedback = esito !== null;
  const secondiTimer = livello.secondiTimer;

  /* ---- Il round si chiude qui: è l'unico punto che assegna punti e statistiche. */
  const concludi = useCallback((rispostaFinale, tempoScaduto = false) => {
    if (inFeedback) return;
    const msImpiegati = performance.now() - inizioRound.current;

    const valutato = tempoScaduto
      ? {
          corretta: false, parziale: false, errore: 'tempo-scaduto',
          titolo: 'Tempo scaduto', messaggio: 'Il cliente si è spazientito.',
          mostraResto: transazione.bastano, minima: false, etichettaBonus: null,
          composizioneDaMostrare: null, pezziResi: null, ricevutoEffettivo: null,
        }
      : valutaRisposta(transazione, rispostaFinale, cassetto);

    const nuovaStreak = valutato.corretta ? streak + 1 : 0;
    const guadagno = calcolaPunti({
      corretta: valutato.corretta,
      minima: valutato.minima,
      etichettaBonus: valutato.etichettaBonus,
      msImpiegati,
      secondiTimer,
      streak,
    });

    setEsito(valutato);
    setPremio(guadagno);
    setPunteggio(p => p + guadagno.punti);
    setStreak(nuovaStreak);
    setStreakMassima(m => Math.max(m, nuovaStreak));
    setCorrette(c => c + (valutato.corretta ? 1 : 0));
    setTempi(t => [...t, msImpiegati]);

    onEsito?.({
      esercizio: transazione.tipoEsercizio,
      corretta: valutato.corretta,
      minima: valutato.minima,
      msImpiegati,
      errore: valutato.errore,
    });

    // Nel Turno il cassetto cambia davvero, con i pezzi che il giocatore ha
    // scelto: se ha reso male, a fine giornata la cassa non quadra. È il punto
    // di tutta la modalità.
    if (turno && transazione.bastano) {
      const resi = valutato.pezziResi ?? transazione.composizioneResto;
      const dopo = registraTransazione(cassetto, transazione.pezziPorti, resi);
      if (dopo) setCassetto(dopo);
      setIncassoAtteso(i => i + transazione.conto);
    }

    vibra(valutato.corretta);
  }, [inFeedback, transazione, cassetto, streak, secondiTimer, turno, onEsito]);

  /*
   * Il conto alla rovescia e' un solo setTimeout, non un intervallo a 10 Hz:
   * la barra che si svuota e' un'animazione CSS (vedi BarraStato), quindi
   * durante il round non c'e' nemmeno un re-render. Su un telefono e' la
   * differenza fra un gioco che scalda la batteria e uno che non la tocca.
   */
  const concludiRef = useRef(concludi);
  concludiRef.current = concludi;
  useEffect(() => {
    if (secondiTimer <= 0 || inFeedback) return undefined;
    const id = setTimeout(() => concludiRef.current(rispostaRef.current, true), secondiTimer * 1000);
    return () => clearTimeout(id);
  }, [secondiTimer, inFeedback, transazione.id]);

  const prossimoCliente = () => {
    const ultimo = turno && indice >= CLIENTI_PER_TURNO;
    if (ultimo) {
      onFine({
        modalita,
        punteggio,
        streakMassima,
        clienti: indice,
        corrette,
        tempi,
        chiusura: chiusuraCassa(cassettoIniziale.current, cassetto, incassoAtteso),
      });
      return;
    }

    const nuova = generaTransazione(livello, { cassetto, rng: rng.current });
    setTransazione(nuova);
    setRisposta(rispostaIniziale(nuova.tipoEsercizio));
    setEsito(null);
    setPremio({ punti: 0, dettaglio: [] });
    setIndice(i => i + 1);
    inizioRound.current = performance.now();
  };

  const chiudiAllenamento = () => {
    onFine({ modalita, punteggio, streakMassima, clienti: indice, corrette, tempi, chiusura: null });
  };

  const esauriti = turno ? tagliEsauriti(cassetto).map(v => ({ valore: v, etichetta: etichettaTaglio(v) })) : [];

  return (
    <div className="app">
      <BarraStato
        titolo={ESERCIZI[transazione.tipoEsercizio]?.nome ?? 'Cassa'}
        sottotitolo={turno ? 'Turno di cassa' : `Livello ${livello.numero} · ${livello.nome}`}
        punteggio={punteggio}
        streak={streak}
        progresso={turno ? `${indice}/${CLIENTI_PER_TURNO}` : String(indice)}
        secondiTimer={inFeedback ? 0 : secondiTimer}
        chiaveRound={transazione.id}
        onEsci={onEsci}
      />

      <main className="scena">
        {turno && <StatoCassetto totale={totaleCassetto(cassetto)} esauriti={esauriti} />}

        {inFeedback ? (
          <Feedback
            esito={esito}
            transazione={transazione}
            punti={premio.punti}
            dettaglioPunti={premio.dettaglio}
          />
        ) : (
          <Esercizio
            transazione={transazione}
            risposta={risposta}
            onRisposta={setRisposta}
            cassetto={cassetto}
          />
        )}
      </main>

      <div className="azioni">
        {inFeedback ? (
          <>
            {!turno && (
              <button type="button" className="pulsante pulsante--fantasma" onClick={chiudiAllenamento}>
                Basta così
              </button>
            )}
            <button type="button" className="pulsante pulsante--principale" onClick={prossimoCliente}>
              {turno && indice >= CLIENTI_PER_TURNO ? 'Chiudi la cassa' : 'Cliente dopo →'}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="pulsante pulsante--principale"
            disabled={!rispostaPronta(transazione.tipoEsercizio, risposta)}
            onClick={() => concludi(risposta)}
          >
            Conferma
          </button>
        )}
      </div>
    </div>
  );
}

/** Vibrazione corta: c'è solo dove il browser la offre, e non deve mai far crashare il round. */
function vibra(corretta) {
  try {
    navigator.vibrate?.(corretta ? 20 : [40, 60, 40]);
  } catch {
    // Alcuni browser la dichiarano e poi la rifiutano: non è un errore di gioco.
  }
}
