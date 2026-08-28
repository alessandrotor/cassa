import test from 'node:test';
import assert from 'node:assert/strict';

import { VALORI_RESTO } from '../src/data/valuta.js';
import {
  restoOttimale, verificaComposizione, conteggioProgressivo,
  creaTabellaResti, leggiTabella, creaCalcolatoreResto,
} from '../src/utils/resto.js';
import { sommaPezzi, contaPezzi, formatEuro, parseEuro } from '../src/utils/soldi.js';

/**
 * La DP pura, senza la scorciatoia del greedy: e' il riferimento contro cui si
 * misura restoOttimale. Da quando restoOttimale prova prima il greedy, e' solo
 * questo confronto a tenere onesta la scorciatoia.
 *
 * La tabella si costruisce una volta sola e risponde per ogni importo fino al
 * tetto: ricostruirla a ogni domanda renderebbe questi test cento volte piu'
 * lenti senza verificare niente di piu'.
 */
function riferimentoDP(centMax, disponibilita = null) {
  const tabella = creaTabellaResti(centMax, disponibilita);
  return cent => leggiTabella(tabella, cent);
}

test('formatEuro e parseEuro fanno il giro completo senza perdere centesimi', () => {
  for (const cent of [0, 1, 5, 99, 100, 760, 800, 1234, 5000]) {
    assert.equal(parseEuro(formatEuro(cent)), cent, `giro fallito su ${cent}`);
  }
  assert.equal(formatEuro(760), '7,60 €');
  assert.equal(parseEuro('7,60'), 760);
  assert.equal(parseEuro('non un numero'), null);
});

test('senza vincoli la scorciatoia da la stessa risposta della DP, su ogni importo fino a 50 €', () => {
  const dp = riferimentoDP(5000);
  for (let cent = 1; cent <= 5000; cent++) {
    const veloce = restoOttimale(cent);
    const lenta = dp(cent);
    assert.ok(veloce.possibile, `${cent} dovrebbe essere sempre componibile`);
    assert.equal(sommaPezzi(veloce.pezzi), cent, `somma sbagliata su ${cent}`);
    assert.equal(
      veloce.totalePezzi,
      lenta.totalePezzi,
      `l'euro e' canonico: su ${cent} il greedy non deve fare peggio della DP`,
    );
    assert.equal(contaPezzi(veloce.pezzi), veloce.totalePezzi);
  }
});

test('anche a scorte limitate la scorciatoia non si discosta mai dalla DP', () => {
  // Un cassetto povero e sbilenco: e' il caso in cui il greedy si arena e deve
  // cedere il passo alla DP. Su ogni importo le due strade devono concordare
  // sia sul numero di pezzi sia sul fatto che il resto si possa comporre.
  const cassetti = [
    { 500: 1, 200: 2, 100: 1, 50: 2, 20: 1, 10: 1, 5: 1, 2: 2, 1: 2 },
    { 2000: 1, 1000: 1, 500: 1, 200: 3, 50: 1, 20: 4 },
    { 200: 5, 100: 1, 20: 3 },
    { 50: 1, 20: 3 },
  ];
  for (const cassetto of cassetti) {
    const massimo = sommaPezzi(cassetto);
    const dp = riferimentoDP(massimo, cassetto);
    for (let cent = 1; cent <= massimo; cent++) {
      const veloce = restoOttimale(cent, cassetto);
      const lenta = dp(cent);
      assert.equal(veloce.possibile, lenta.possibile, `disaccordo sul possibile per ${cent}`);
      if (!lenta.possibile) continue;
      assert.equal(veloce.totalePezzi, lenta.totalePezzi, `pezzi diversi su ${cent}`);
      assert.equal(sommaPezzi(veloce.pezzi), cent, `somma sbagliata su ${cent}`);
    }
  }
});

test('il calcolatore riusabile risponde come restoOttimale', () => {
  const cassetto = { 500: 1, 200: 2, 100: 1, 50: 2, 20: 1, 10: 1 };
  for (const disponibilita of [null, cassetto]) {
    const calcolatore = creaCalcolatoreResto(1200, disponibilita);
    for (let cent = 0; cent <= 1200; cent++) {
      const atteso = restoOttimale(cent, disponibilita);
      assert.equal(calcolatore.valuta(cent).possibile, atteso.possibile, `possibile diverso su ${cent}`);
      assert.equal(
        calcolatore.quantiPezzi(cent),
        atteso.possibile ? atteso.totalePezzi : -1,
        `conteggio diverso su ${cent}`,
      );
    }
    // Oltre il tetto dichiarato non risponde a caso: dice che non si puo'.
    assert.equal(calcolatore.valuta(1201).possibile, false);
    assert.equal(calcolatore.quantiPezzi(1201), -1);
  }
});

test('il caso canonico: 7,90 € sono 5 pezzi, 8,00 € ne sono 3', () => {
  assert.equal(restoOttimale(790).totalePezzi, 5);
  assert.equal(restoOttimale(800).totalePezzi, 3);
  assert.deepEqual(restoOttimale(800).pezzi, { 500: 1, 200: 1, 100: 1 });
});

test('con scorte limitate trova soluzioni dove il greedy si arenerebbe', () => {
  // 60 c con una moneta da 50 e tre da 20: il greedy prende il 50 e resta
  // bloccato sui 10 c che non ci sono. La risposta giusta e' 3x 20 c.
  const cassetto = { 50: 1, 20: 3 };
  const esito = restoOttimale(60, cassetto);
  assert.ok(esito.possibile);
  assert.deepEqual(esito.pezzi, { 20: 3 });
  assert.equal(sommaPezzi(esito.pezzi), 60);
});

test('dichiara impossibile solo i resti che davvero non si possono comporre', () => {
  assert.equal(restoOttimale(60, { 50: 1 }).possibile, false);
  assert.equal(restoOttimale(390, { 200: 1, 50: 1, 20: 2 }).possibile, false);
  assert.equal(restoOttimale(0).possibile, true);
  assert.equal(restoOttimale(-100).possibile, false);
});

test('non usa mai piu pezzi di quanti ce ne sono in cassetto', () => {
  const cassetto = { 500: 1, 200: 2, 100: 1, 50: 2, 20: 1, 10: 1, 5: 1, 2: 2, 1: 2 };
  for (let cent = 1; cent <= 1200; cent++) {
    const esito = restoOttimale(cent, cassetto);
    if (!esito.possibile) continue;
    assert.equal(sommaPezzi(esito.pezzi), cent, `somma sbagliata su ${cent}`);
    for (const [valore, quantita] of Object.entries(esito.pezzi)) {
      assert.ok(
        quantita <= (cassetto[valore] ?? 0),
        `su ${cent} usa ${quantita}x ${valore} ma in cassa ce ne sono ${cassetto[valore] ?? 0}`,
      );
    }
  }
});

test('con scorte abbondanti il vincolo non cambia niente', () => {
  const abbondante = Object.fromEntries(VALORI_RESTO.map(v => [v, 200]));
  const dpVincolata = riferimentoDP(800, abbondante);
  const dpLibera = riferimentoDP(800);
  for (let cent = 1; cent <= 800; cent++) {
    assert.equal(
      restoOttimale(cent, abbondante).totalePezzi,
      restoOttimale(cent).totalePezzi,
      `divergenza su ${cent}`,
    );
    assert.equal(dpVincolata(cent).totalePezzi, dpLibera(cent).totalePezzi, `divergenza DP su ${cent}`);
  }
});

test('verificaComposizione accetta la cifra esatta e segnala se e minima', () => {
  // 7,60 € reso come 5 + 2 + 0,50 + 0,10 -> esatto e minimo
  const minima = verificaComposizione({ 500: 1, 200: 1, 50: 1, 10: 1 }, 760);
  assert.ok(minima.esatta);
  assert.ok(minima.minima);

  // stesso importo con 7 monete da 1 € + spiccioli -> esatto ma non minimo
  const prolissa = verificaComposizione({ 100: 7, 50: 1, 10: 1 }, 760);
  assert.ok(prolissa.esatta);
  assert.equal(prolissa.minima, false);
  assert.equal(prolissa.totalePezziOttimali, 4);

  const sbagliata = verificaComposizione({ 500: 1 }, 760);
  assert.equal(sbagliata.esatta, false);
  assert.equal(sbagliata.differenza, -260);
});

test('verificaComposizione segnala quando il giocatore sfora le scorte', () => {
  const esito = verificaComposizione({ 100: 3 }, 300, { 100: 1, 200: 1 });
  assert.ok(esito.esatta);
  assert.ok(esito.eccedeScorte);
});

test('il conteggio progressivo sale dal conto al ricevuto, pezzo per pezzo', () => {
  const passi = conteggioProgressivo(1240, 2000);
  assert.deepEqual(passi.map(p => p.cumulato), [1250, 1300, 1500, 2000]);
  assert.deepEqual(passi.map(p => p.valore), [10, 50, 200, 500]);
  assert.equal(passi.at(-1).cumulato, 2000);
});

test('il conteggio progressivo arriva sempre al ricevuto, anche su composizioni non minime', () => {
  const passi = conteggioProgressivo(1240, 2000, { 100: 7, 50: 1, 10: 1 });
  assert.equal(passi.at(-1).cumulato, 2000);
  assert.equal(passi.length, 9);
});

test('resto zero: pagamento esatto, nessun passo da contare', () => {
  assert.deepEqual(conteggioProgressivo(1500, 1500), []);
  assert.deepEqual(restoOttimale(0).pezzi, {});
});
