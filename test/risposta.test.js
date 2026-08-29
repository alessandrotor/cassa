import test from 'node:test';
import assert from 'node:assert/strict';

import { LIVELLI, livelloLibero, ESERCIZI } from '../src/data/livelli.js';
import { creaRng, generaTransazione } from '../src/utils/generatore.js';
import { rispostaIniziale, rispostaPronta } from '../src/utils/risposta.js';
import { valutaRisposta } from '../src/utils/valutazione.js';
import { restoOttimale } from '../src/utils/resto.js';
import { creaCassetto } from '../src/utils/cassetto.js';
import { FONDO_CASSA_INIZIALE } from '../src/data/valuta.js';

/** La risposta che il gioco dovrebbe considerare giusta per quella transazione. */
function rispostaGiusta(t, cassetto) {
  if (t.tipoEsercizio === 'chiedi-spiccioli') {
    return { chiesti: t.suggerimento?.conviene ? t.suggerimento.daChiedere : {} };
  }
  if (!t.bastano) return { pezzi: {}, dichiarazione: 'non-basta' };
  if (t.resto === 0) return { pezzi: {}, dichiarazione: 'senza-resto' };
  return { pezzi: restoOttimale(t.resto, cassetto).pezzi, dichiarazione: null };
}

test('la risposta vuota non e mai confermabile: senza far niente non si conferma', () => {
  for (const tipo of Object.keys(ESERCIZI)) {
    const vuota = rispostaIniziale(tipo);
    if (tipo === 'chiedi-spiccioli') {
      assert.ok(rispostaPronta(tipo, vuota), 'non chiedere niente e una scelta legittima');
    } else {
      assert.equal(rispostaPronta(tipo, vuota), false, `${tipo}: si conferma senza aver risposto`);
    }
  }
});

test('le due dichiarazioni bastano da sole a poter confermare', () => {
  for (const dichiarazione of ['senza-resto', 'non-basta']) {
    assert.ok(rispostaPronta('componi', { pezzi: {}, dichiarazione }), dichiarazione);
  }
  assert.ok(rispostaPronta('componi', { pezzi: { 100: 1 }, dichiarazione: null }));
});

test('ogni round generato ha una risposta possibile e giusta', () => {
  // L'invariante che il bug del resto zero violava: con pagamento esatto non
  // c'era nessuna risposta confermabile, e si restava fermi fino al timer.
  for (const cassetto of [null, creaCassetto(FONDO_CASSA_INIZIALE)]) {
    for (const liv of LIVELLI) {
      const rng = creaRng(31 + liv.numero);
      for (let i = 0; i < 400; i++) {
        const t = generaTransazione(liv, { cassetto, rng });
        const risposta = rispostaGiusta(t, cassetto);
        const dove = `livello ${liv.numero}, ${t.tipoEsercizio}, resto ${t.resto}`;

        assert.ok(rispostaPronta(t.tipoEsercizio, risposta), `${dove}: risposta non confermabile`);
        assert.ok(valutaRisposta(t, risposta, cassetto).corretta, `${dove}: la risposta giusta risulta sbagliata`);
      }
    }
  }
});

test('anche i round col pagamento esatto si chiudono, in ogni esercizio', () => {
  // Il pagamento esatto e' raro negli esercizi avanzati: lo cerchiamo apposta.
  for (const tipo of ['componi', 'conta', 'ricevi-spiccioli']) {
    const rng = creaRng(5);
    const liv = livelloLibero([tipo]);
    let trovati = 0;
    for (let i = 0; i < 6000 && trovati < 5; i++) {
      const t = generaTransazione(liv, { rng, tipoForzato: tipo });
      if (!t.bastano || t.resto !== 0) continue;
      trovati++;
      const risposta = { pezzi: {}, dichiarazione: 'senza-resto' };
      assert.ok(rispostaPronta(tipo, risposta), `${tipo}: pagamento esatto non confermabile`);
      const esito = valutaRisposta(t, risposta);
      assert.ok(esito.corretta, `${tipo}: pagamento esatto giudicato sbagliato`);
      assert.equal(esito.mostraResto, false, `${tipo}: mostra un resto che non esiste`);
    }
  }
});

test('al livello 1 il pagamento esatto capita spesso, non e un caso di scuola', () => {
  // Era una transazione su dieci: senza il pulsante dedicato il gioco si
  // inceppava di continuo proprio ai primi passi.
  const rng = creaRng(7);
  let esatti = 0;
  for (let i = 0; i < 2000; i++) {
    const t = generaTransazione(LIVELLI[0], { rng });
    if (t.bastano && t.resto === 0) esatti++;
  }
  assert.ok(esatti > 40, `pagamenti esatti troppo rari per essere significativi: ${esatti}/2000`);
});
