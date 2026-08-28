import test from 'node:test';
import assert from 'node:assert/strict';

import {
  suggerisciSpiccioli,
  valutaRichiesta,
  combinazioniSpiccioli,
  clientePuoDare,
  frasePerChiedere,
} from '../src/utils/spiccioli.js';
import { sommaPezzi, contaPezzi, importoParlato } from '../src/utils/soldi.js';

/** Un portafoglio ben fornito: serve a non far dipendere i test dalla fortuna. */
const PORTAFOGLIO = { 2000: 1, 1000: 1, 200: 2, 100: 2, 50: 2, 20: 2, 10: 3, 5: 2, 2: 2, 1: 2 };

test('il caso da manuale: 12,10 € pagati con 20 €, si chiedono 10 centesimi', () => {
  const esito = suggerisciSpiccioli(1210, 2000, PORTAFOGLIO);
  assert.ok(esito.conviene);
  assert.equal(esito.importoChiesto, 10);
  assert.deepEqual(esito.daChiedere, { 10: 1 });
  assert.equal(esito.pezziPrima, 5);
  assert.equal(esito.pezziDopo, 3);
  assert.equal(esito.restoDopo, 800);
  assert.equal(esito.motivo, 'meno-pezzi');
});

test('quando il resto e gia pulito non si disturba il cliente', () => {
  // 12,50 € con 20 € -> resto 7,50 € = 5 + 2 + 0,50, gia' tre pezzi.
  const esito = suggerisciSpiccioli(1250, 2000, PORTAFOGLIO);
  assert.equal(esito.conviene, false);
  assert.equal(esito.daChiedere, null);
  assert.equal(esito.pezziPrima, 3);
});

test('non si chiede mai qualcosa che il cliente non ha in tasca', () => {
  const tasche = { 2000: 1, 5: 1 };
  const esito = suggerisciSpiccioli(1210, 2000, tasche);
  if (esito.conviene) assert.ok(clientePuoDare(esito.daChiedere, tasche));
  for (const alternativa of esito.alternative) {
    assert.ok(clientePuoDare(alternativa.pezzi, tasche), 'proposta non pagabile dal cliente');
  }
});

test('le combinazioni nascono una volta sola, senza doverle deduplicare', () => {
  const viste = new Set();
  for (const { pezzi } of combinazioniSpiccioli(PORTAFOGLIO)) {
    const chiave = JSON.stringify(pezzi);
    assert.ok(!viste.has(chiave), `manciata generata due volte: ${chiave}`);
    viste.add(chiave);
  }
});

test('ogni combinazione porta con se importo e numero di pezzi gia contati', () => {
  for (const { pezzi, importo, quanti } of combinazioniSpiccioli(PORTAFOGLIO)) {
    assert.equal(importo, sommaPezzi(pezzi), 'importo non coerente con i pezzi');
    assert.equal(quanti, contaPezzi(pezzi), 'conteggio non coerente con i pezzi');
  }
});

test('le combinazioni proposte restano richieste plausibili, non un secondo pagamento', () => {
  const combinazioni = combinazioniSpiccioli(PORTAFOGLIO);
  for (const { pezzi, importo, quanti } of combinazioni) {
    assert.ok(quanti <= 3, 'nessuno tira fuori piu di tre monete');
    assert.ok(importo <= 200, 'oltre i 2 € non e una richiesta di spiccioli');
    assert.ok(clientePuoDare(pezzi, PORTAFOGLIO));
  }
  // c'e' sempre l'opzione "non chiedo niente"
  assert.ok(combinazioni.some(c => c.quanti === 0));
});

test('il suggerimento non peggiora mai la situazione', () => {
  for (let conto = 100; conto <= 1900; conto += 7) {
    const esito = suggerisciSpiccioli(conto, 2000, PORTAFOGLIO);
    if (!esito.conviene) continue;
    assert.ok(
      esito.pezziDopo < esito.pezziPrima,
      `su ${conto} suggerisce di chiedere senza ridurre i pezzi resi`,
    );
    assert.equal(esito.restoDopo, 2000 + esito.importoChiesto - conto);
  }
});

test('con il cassetto agli sgoccioli il suggerimento salva il taglio scarso', () => {
  // Resto 7,90 €: la via normale userebbe le monete da 20 c, e ne resta una sola.
  const cassetto = { 5000: 1, 2000: 2, 1000: 2, 500: 4, 200: 4, 100: 4, 50: 4, 20: 1, 10: 4, 5: 4, 2: 4, 1: 4 };
  const esito = suggerisciSpiccioli(1210, 2000, PORTAFOGLIO, cassetto);
  assert.ok(esito.conviene);
  assert.equal(esito.composizioneDopo[20] ?? 0, 0, 'doveva evitare le monete da 20 c');
});

test('se il resto non e componibile col cassetto, chiedere spiccioli e la via d uscita', () => {
  // Manca tutto il taglio da 10 c: 7,90 € non si compone (7,90 = 5+2+0,50+0,20+0,20
  // e senza 20 c ne' 10 c ne' 5 c non c'e' modo di fare i 40 c finali).
  const cassetto = { 500: 4, 200: 4, 100: 4, 50: 4, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 };
  const base = suggerisciSpiccioli(1210, 2000, PORTAFOGLIO, cassetto);
  assert.equal(base.pezziPrima, null, 'il resto 7,90 € non deve risultare componibile');
  assert.ok(base.conviene);
  assert.equal(base.motivo, 'resto-impossibile');
  assert.equal(base.restoDopo % 50, 0, 'il resto proposto deve stare nei tagli rimasti');
});

test('valutaRichiesta riconosce la scelta ottima', () => {
  const esito = valutaRichiesta({ 10: 1 }, 1210, 2000, PORTAFOGLIO);
  assert.equal(esito.verdetto, 'ottima');
});

test('valutaRichiesta promuove una scelta che migliora anche se non e la migliore', () => {
  // 60 c invece di 10 c: resto 8,50 € = 5 + 2 + 1 + 0,50, quattro pezzi.
  // Meglio dei cinque di partenza, peggio dei tre dell ottimo.
  const esito = valutaRichiesta({ 50: 1, 10: 1 }, 1210, 2000, PORTAFOGLIO);
  assert.equal(esito.verdetto, 'buona');
  assert.match(esito.messaggio, /migliora/);
});

test('valutaRichiesta boccia la richiesta che peggiora le cose', () => {
  // Chiedere 5 c porta il resto a 7,95 €: sei pezzi invece di cinque.
  const esito = valutaRichiesta({ 5: 1 }, 1210, 2000, PORTAFOGLIO);
  assert.equal(esito.verdetto, 'peggiore');
});

test('valutaRichiesta distingue il non chiedere giusto dall occasione persa', () => {
  const persa = valutaRichiesta({}, 1210, 2000, PORTAFOGLIO);
  assert.equal(persa.verdetto, 'occasione-persa');

  const giusto = valutaRichiesta({}, 1250, 2000, PORTAFOGLIO);
  assert.equal(giusto.verdetto, 'giusto-non-chiedere');
});

test('valutaRichiesta rifiuta cio che il cliente non ha', () => {
  const esito = valutaRichiesta({ 10: 1 }, 1210, 2000, { 2000: 1 });
  assert.equal(esito.verdetto, 'non-disponibile');
});

test('la frase da dire al cliente e in italiano parlato', () => {
  assert.equal(frasePerChiedere({ 10: 1 }), 'Ha 10 centesimi?');
  assert.equal(frasePerChiedere({ 1: 1 }), 'Ha un centesimo?');
  assert.equal(frasePerChiedere({ 100: 1 }), 'Ha un euro?');
  assert.equal(frasePerChiedere({ 50: 1, 10: 1 }), 'Ha 60 centesimi?');
  assert.equal(frasePerChiedere({ 100: 1, 50: 2 }), 'Ha 2 euro?');
  assert.equal(frasePerChiedere({ 200: 1, 10: 1 }), 'Ha 2 euro e 10?');
  assert.equal(frasePerChiedere({}), 'Non chiedo niente');
});

test('gli importi parlati non suonano mai come un tabulato', () => {
  assert.equal(importoParlato(5), '5 centesimi');
  assert.equal(importoParlato(1), 'un centesimo');
  assert.equal(importoParlato(100), 'un euro');
  assert.equal(importoParlato(250), '2 euro e 50');
  assert.equal(importoParlato(300), '3 euro');
  // Nessuna forma deve contenere il "1x" della descrizione compatta.
  for (const cent of [1, 5, 20, 99, 100, 105, 250, 5000]) {
    assert.ok(!importoParlato(cent).includes('×'), `importo ${cent} descritto come un elenco`);
  }
});
