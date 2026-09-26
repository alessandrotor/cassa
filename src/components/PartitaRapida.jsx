import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { creaRng, generaTransazione } from '../utils/generatore.js';
import { formatEuro } from '../utils/soldi.js';
import {
  CLIENTI_PER_SESSIONE_RAPIDA, livelloRapido, ritmo as ritmoDi,
  secondiPerCliente, esitoRapido, riassuntoRapido,
} from '../utils/lampo.js';

import BarraStato from './BarraStato.jsx';
import Esercizio from './Esercizi.jsx';

/** Quanto resta a schermo l'esito: giusto si legge in un attimo, sbagliato va capito. */
const MS_ESITO_GIUSTO = 650;
const MS_ESITO_SBAGLIATO = 1800;

/**
 * Resto rapido: un cliente dopo l'altro, pochi secondi a testa, nessuna
 * spiegazione in mezzo. Allo scadere del tempo si consegna quello che c'è nel
 * vassoio, anche se è vuoto — al banco il cliente non aspetta che tu finisca.
 */
export default function PartitaRapida({ ritmo, prezzi, onFine, onEsci }) {
  const livello = useMemo(() => livelloRapido(prezzi), [prezzi]);
  const rng = useRef(creaRng(Date.now()));

  const [transazione, setTransazione] = useState(() => generaTransazione(livello, { rng: rng.current }));
  const [risposta, setRisposta] = useState({ pezzi: {}, dichiarazione: null });
  const [esiti, setEsiti] = useState([]);
  const [ultimo, setUltimo] = useState(null);
  const [serie, setSerie] = useState(0);

  const inizioRound = useRef(performance.now());
  const roundChiuso = useRef(false);
  const rispostaRef = useRef(risposta);
  rispostaRef.current = risposta;

  const secondi = secondiPerCliente(ritmo, transazione);
  const inEsito = ultimo !== null;
  const esatti = esiti.filter(e => e.esatto).length;

  const consegna = useCallback(scaduto => {
    if (roundChiuso.current) return;
    roundChiuso.current = true;
    const esito = esitoRapido(transazione, rispostaRef.current.pezzi, {
      msImpiegati: performance.now() - inizioRound.current,
      scaduto,
    });
    setEsiti(precedenti => [...precedenti, esito]);
    setUltimo(esito);
    setSerie(s => (esito.esatto ? s + 1 : 0));
    vibra(esito.esatto);
  }, [transazione]);

  // Il tocco sull'esito e l'attesa che scade possono arrivare insieme: si
  // passa al cliente dopo, o si chiude la sessione, una volta sola.
  const finita = useRef(false);
  const avanti = useCallback(() => {
    if (!roundChiuso.current || finita.current) return;
    if (esiti.length >= CLIENTI_PER_SESSIONE_RAPIDA) {
      finita.current = true;
      onFine({ ritmo, prezzi, esiti, riassunto: riassuntoRapido(esiti) });
      return;
    }
    const nuova = generaTransazione(livello, { rng: rng.current });
    setTransazione(nuova);
    setRisposta({ pezzi: {}, dichiarazione: null });
    setUltimo(null);
    roundChiuso.current = false;
    inizioRound.current = performance.now();
  }, [esiti, livello, onFine, ritmo, prezzi]);

  // Il tempo del cliente: allo scadere si consegna quello che hai in mano.
  useEffect(() => {
    if (inEsito) return undefined;
    const id = setTimeout(() => consegna(true), secondi * 1000);
    return () => clearTimeout(id);
  }, [inEsito, secondi, consegna]);

  // L'esito resta a schermo un attimo, poi arriva il cliente dopo da solo.
  useEffect(() => {
    if (!inEsito) return undefined;
    const id = setTimeout(avanti, ultimo.esatto ? MS_ESITO_GIUSTO : MS_ESITO_SBAGLIATO);
    return () => clearTimeout(id);
  }, [inEsito, ultimo, avanti]);

  // Invio consegna, e sull'esito salta l'attesa.
  const invio = useRef(null);
  invio.current = () => (inEsito ? avanti() : consegna(false));
  useEffect(() => {
    const suTasto = evento => {
      if (evento.key !== 'Enter' || evento.repeat) return;
      evento.preventDefault();
      invio.current();
    };
    window.addEventListener('keydown', suTasto);
    return () => window.removeEventListener('keydown', suTasto);
  }, []);

  return (
    <div className="app">
      <BarraStato
        titolo={`Ritmo ${ritmoDi(ritmo).nome.toLowerCase()}`}
        sottotitolo="Resto rapido"
        punteggio={esatti}
        etichettaPunteggio="Esatti"
        streak={serie}
        progresso={`${Math.min(esiti.length + (inEsito ? 0 : 1), CLIENTI_PER_SESSIONE_RAPIDA)}/${CLIENTI_PER_SESSIONE_RAPIDA}`}
        secondiTimer={inEsito ? 0 : secondi}
        chiaveRound={transazione.id}
        onEsci={onEsci}
      />

      <main className="scena">
        {inEsito ? (
          <EsitoLampo esito={ultimo} onSalta={avanti} />
        ) : (
          <Esercizio
            transazione={transazione}
            risposta={risposta}
            onRisposta={setRisposta}
            cassetto={null}
            rapido
          />
        )}
      </main>

      <div className="azioni">
        <button
          type="button"
          className="pulsante pulsante--principale"
          disabled={inEsito}
          onClick={() => consegna(false)}
        >
          Consegna il resto
        </button>
      </div>
    </div>
  );
}

function EsitoLampo({ esito, onSalta }) {
  const { esatto, differenza, resto, dato, scaduto } = esito;
  return (
    <button
      type="button"
      className={`lampo-esito ${esatto ? 'lampo-esito--ok' : 'lampo-esito--errore'}`}
      onClick={onSalta}
    >
      <span className="lampo-esito__segno">{esatto ? '✓' : '✗'}</span>
      <span className="lampo-esito__titolo cifra">
        {esatto
          ? 'Giusto'
          : `${formatEuro(Math.abs(differenza))} ${differenza > 0 ? 'in più' : 'in meno'}`}
      </span>
      {!esatto && (
        <span className="lampo-esito__dettaglio">
          {scaduto ? 'Tempo scaduto: ' : ''}
          il resto era <strong className="cifra">{formatEuro(resto)}</strong>, hai dato{' '}
          <strong className="cifra">{formatEuro(dato)}</strong>
        </span>
      )}
      <span className="lampo-esito__salta">tocca per andare avanti</span>
    </button>
  );
}

function vibra(esatto) {
  try {
    navigator.vibrate?.(esatto ? 15 : [40, 60, 40]);
  } catch {
    // Non disponibile: non è un errore di gioco.
  }
}
