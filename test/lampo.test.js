import test from 'node:test';
import assert from 'node:assert/strict';

import { creaRng, generaTransazione } from '../src/utils/generatore.js';
import {
  RITMI, PREZZI, livelloRapido, secondiPerCliente, esitoRapido, riassuntoRapido,
} from '../src/utils/lampo.js';
import {
  statisticheVuote, registraSessioneRapida, recordRapido, normalizzaStatistiche,
  registraEsito,
} from '../src/utils/statistiche.js';

test('il resto rapido non genera mai pagamenti che non bastano', () => {
  const rng = creaRng(7);
  for (const prezzi of Object.keys(PREZZI)) {
    const livello = livelloRapido(prezzi);
    for (let i = 0; i < 400; i++) {
      const t = generaTransazione(livello, { rng });
      assert.ok(t.bastano, `${prezzi}: pagamento insufficiente`);
      assert.notEqual(t.tipoEsercizio, 'chiedi-spiccioli');
      assert.ok(t.conto >= livello.contoMin && t.conto <= livello.contoMax + 99);
    }
  }
});

test('piu pezzi da contare, piu tempo; e ogni ritmo e piu stretto del precedente', () => {
  const facile = { composizioneResto: { 500: 1 }, pezziPorti: { 1000: 1 } };
  const difficile = { composizioneResto: { 500: 1, 200: 1, 50: 1, 20: 2 }, pezziPorti: { 2000: 1, 10: 1 } };
  const chiavi = Object.keys(RITMI);
  for (const ritmo of chiavi) {
    assert.ok(secondiPerCliente(ritmo, difficile) > secondiPerCliente(ritmo, facile), ritmo);
  }
  for (let i = 1; i < chiavi.length; i++) {
    assert.ok(secondiPerCliente(chiavi[i], difficile) < secondiPerCliente(chiavi[i - 1], difficile));
  }
});

test('esito: in piu, in meno, esatto, e vassoio vuoto', () => {
  const t = { conto: 1210, ricevuto: 2000, resto: 790 };
  assert.equal(esitoRapido(t, { 500: 1, 200: 1, 100: 1 }).differenza, 10);
  assert.equal(esitoRapido(t, { 500: 1, 200: 1, 50: 1 }).differenza, -40);
  assert.ok(esitoRapido(t, { 500: 1, 200: 1, 50: 1, 20: 2 }).esatto);
  const vuoto = esitoRapido(t, {}, { scaduto: true });
  assert.equal(vuoto.dato, 0);
  assert.equal(vuoto.differenza, -790);
  assert.ok(vuoto.scaduto);
});

test('il riassunto tiene separati gli errori in piu e in meno', () => {
  const t = { conto: 1000, ricevuto: 2000, resto: 1000 };
  const esiti = [
    esitoRapido(t, { 1000: 1 }, { msImpiegati: 2000 }),
    esitoRapido(t, { 1000: 1, 200: 1 }, { msImpiegati: 3000 }),
    esitoRapido(t, { 500: 1, 200: 1, 100: 1 }, { msImpiegati: 4000 }),
    esitoRapido(t, {}, { msImpiegati: 5000, scaduto: true }),
  ];
  const r = riassuntoRapido(esiti);
  assert.equal(r.clienti, 4);
  assert.equal(r.esatti, 1);
  assert.equal(r.totaleInPiu, 200);
  assert.equal(r.volteInPiu, 1);
  assert.equal(r.totaleInMeno, 200 + 1000);
  assert.equal(r.volteInMeno, 2);
  assert.equal(r.saldoCassa, 1000);
  assert.equal(r.scaduti, 1);
  // Il tempo scaduto non e un tempo di risposta: falserebbe la media.
  assert.equal(r.tempoMedio, 3000);
  assert.equal(r.peggiore.differenza, -1000);
});

test('storico e record delle sessioni rapide', () => {
  let stats = statisticheVuote();
  const sessione = (esatti, inPiu) => ({
    ritmo: 'svelto',
    prezzi: 'realistico',
    riassunto: { clienti: 20, esatti, totaleInPiu: inPiu, totaleInMeno: 0, tempoMedio: 4000 },
  });
  assert.equal(recordRapido(stats, 'svelto', 'realistico'), null);
  stats = registraSessioneRapida(stats, { ...sessione(15, 300), data: 1 });
  stats = registraSessioneRapida(stats, { ...sessione(18, 500), data: 2 });
  stats = registraSessioneRapida(stats, { ...sessione(18, 100), data: 3 });
  assert.equal(stats.rapido.sessioni, 3);
  assert.equal(recordRapido(stats, 'svelto', 'realistico').data, 3, 'a parita vince chi sbaglia meno soldi');
  assert.equal(recordRapido(stats, 'lampo', 'realistico'), null);
  // Il resto rapido non tocca livelli ne esercizi.
  assert.equal(stats.tentativiPerLivello, 0);
});

test('i salvataggi vecchi senza storico rapido si caricano', () => {
  const vecchie = { ...statisticheVuote() };
  delete vecchie.rapido;
  const caricate = normalizzaStatistiche(vecchie);
  assert.deepEqual(caricate.rapido, { sessioni: 0, storico: [] });
  assert.equal(normalizzaStatistiche({ versione: 1 }).livelloRaggiunto, 1);
  assert.equal(normalizzaStatistiche(null).livelloRaggiunto, 1);
  assert.ok(registraSessioneRapida(caricate, {
    ritmo: 'calmo', prezzi: 'tondo',
    riassunto: { clienti: 1, esatti: 1, totaleInPiu: 0, totaleInMeno: 0, tempoMedio: null },
  }).rapido.storico.length === 1);
});

test('le risposte del Turno contano per l\'esercizio ma non per il livello', () => {
  const stats = registraEsito(statisticheVuote(), { esercizio: 'conta', corretta: true, perLivello: false });
  assert.equal(stats.perEsercizio.conta.corrette, 1);
  assert.equal(stats.correttePerLivello, 0);
  assert.equal(stats.esitiPerLivello.length, 0);
});
