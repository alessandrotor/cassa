import test from 'node:test';
import assert from 'node:assert/strict';

import { valutaRisposta } from '../src/utils/valutazione.js';
import { registraTransazione, creaCassetto, totaleCassetto } from '../src/utils/cassetto.js';
import { restoOttimale } from '../src/utils/resto.js';
import { FONDO_CASSA_INIZIALE } from '../src/data/valuta.js';

/**
 * Quello che il Turno fa col cassetto dopo ogni risposta, come in Partita.jsx:
 * se la valutazione non dicesse cosa entra e cosa esce, un errore verrebbe
 * corretto in silenzio e la cassa quadrerebbe lo stesso.
 */
function applica(cassetto, transazione, esito) {
  if (esito.annullata) return { cassetto, atteso: 0 };
  const incassati = esito.pezziIncassati ?? transazione.pezziPorti;
  const resi = esito.pezziResi ?? transazione.composizioneResto;
  return { cassetto: registraTransazione(cassetto, incassati, resi), atteso: transazione.conto };
}

function transazione(conto, pezziPorti, extra = {}) {
  const ricevuto = Object.entries(pezziPorti).reduce((s, [v, q]) => s + v * q, 0);
  const resto = Math.max(0, ricevuto - conto);
  return {
    tipoEsercizio: 'componi', conto, pezziPorti, ricevuto,
    bastano: ricevuto >= conto, resto, mancano: Math.max(0, conto - ricevuto),
    composizioneResto: restoOttimale(resto).pezzi, portafoglioCliente: {}, ...extra,
  };
}

const differenzaCassa = (prima, { cassetto, atteso }) => totaleCassetto(cassetto) - totaleCassetto(prima) - atteso;

test('dire «ha pagato giusto» quando c\'era un resto lascia la cassa in avanzo', () => {
  const cassetto = creaCassetto(FONDO_CASSA_INIZIALE);
  const t = transazione(1210, { 2000: 1 });
  const esito = valutaRisposta(t, { pezzi: {}, dichiarazione: 'senza-resto' }, cassetto);
  assert.equal(esito.corretta, false);
  assert.equal(differenzaCassa(cassetto, applica(cassetto, t, esito)), 790);
});

test('non accorgersi che i soldi non bastano lascia la cassa in ammanco', () => {
  const cassetto = creaCassetto(FONDO_CASSA_INIZIALE);
  const t = transazione(1250, { 500: 1, 200: 2 });
  const esito = valutaRisposta(t, { pezzi: {}, dichiarazione: 'senza-resto' }, cassetto);
  assert.equal(differenzaCassa(cassetto, applica(cassetto, t, esito)), -350);
});

test('accorgersi che non basta non muove il cassetto', () => {
  const cassetto = creaCassetto(FONDO_CASSA_INIZIALE);
  const t = transazione(1250, { 500: 1, 200: 2 });
  const esito = valutaRisposta(t, { pezzi: {}, dichiarazione: 'non-basta' }, cassetto);
  assert.ok(esito.corretta);
  const dopo = applica(cassetto, t, esito);
  assert.deepEqual(dopo.cassetto, cassetto);
  assert.equal(dopo.atteso, 0);
});

test('le monete chieste al cliente entrano davvero nel cassetto', () => {
  const cassetto = creaCassetto(FONDO_CASSA_INIZIALE);
  const t = transazione(1210, { 2000: 1 }, {
    tipoEsercizio: 'chiedi-spiccioli',
    portafoglioCliente: { 10: 2, 100: 1 },
  });
  const esito = valutaRisposta(t, { chiesti: { 10: 1 } }, cassetto);
  const dopo = applica(cassetto, t, esito);
  assert.equal(differenzaCassa(cassetto, dopo), 0, 'la cassa quadra');
  assert.equal(dopo.cassetto[10], cassetto[10] + 1, 'la moneta chiesta e in cassa');
  // 8,00 € di resto: nessuna moneta sotto l'euro esce dal cassetto.
  for (const v of [50, 20, 5, 2, 1]) assert.equal(dopo.cassetto[v], cassetto[v], `${v}`);
});
