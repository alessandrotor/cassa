import test from 'node:test';
import assert from 'node:assert/strict';

import { valutaRisposta } from '../src/utils/valutazione.js';
import { restoOttimale } from '../src/utils/resto.js';
import { creaCassetto } from '../src/utils/cassetto.js';
import { FONDO_CASSA_INIZIALE } from '../src/data/valuta.js';

/** Una transazione fatta a mano: i test sul giudizio non devono dipendere dal caso. */
function transazione(sovrascritture = {}) {
  const base = {
    id: 'prova',
    tipoEsercizio: 'componi',
    conto: 1240,
    ricevuto: 2000,
    resto: 760,
    bastano: true,
    mancano: 0,
    portafoglioCliente: { 2000: 1, 100: 2, 50: 1, 20: 2, 10: 2, 5: 1 },
    pezziPorti: { 2000: 1 },
    spiccioliAggiunti: null,
    suggerimento: null,
  };
  const t = { ...base, ...sovrascritture };
  t.composizioneResto = restoOttimale(t.resto).pezzi;
  return t;
}

test('il resto conta se la cifra e esatta, e il minimo dei pezzi vale il bonus', () => {
  const t = transazione();

  const minima = valutaRisposta(t, { pezzi: { 500: 1, 200: 1, 50: 1, 10: 1 } });
  assert.ok(minima.corretta);
  assert.ok(minima.minima, 'quattro pezzi sono il minimo per 7,60 €');
  assert.equal(minima.parziale, false);

  const prolissa = valutaRisposta(t, { pezzi: { 100: 7, 50: 1, 10: 1 } });
  assert.ok(prolissa.corretta, 'la cifra esatta resta una risposta giusta');
  assert.ok(prolissa.parziale, 'ma va segnalata come migliorabile');
  assert.equal(prolissa.minima, false);
  assert.equal(prolissa.errore, 'composizione-non-minima');
  assert.match(prolissa.messaggio, /9 pezzi/);
});

test('si viene ripresi se si rende troppo o troppo poco, e dice di quanto', () => {
  const t = transazione();

  const troppo = valutaRisposta(t, { pezzi: { 500: 1, 200: 2 } }); // 9,00 € invece di 7,60 €
  assert.equal(troppo.corretta, false);
  assert.equal(troppo.errore, 'cifra-sbagliata');
  assert.match(troppo.messaggio, /1,40 €/);

  const poco = valutaRisposta(t, { pezzi: { 500: 1 } });
  assert.equal(poco.corretta, false);
  assert.match(poco.messaggio, /2,60 €/);

  const niente = valutaRisposta(t, { pezzi: {} });
  assert.equal(niente.corretta, false);
  assert.match(niente.titolo, /niente/i);
});

test('non si puo rendere con tagli che il cassetto non ha', () => {
  const t = transazione({ resto: 300 });
  const cassetto = creaCassetto({ 100: 1, 200: 1 });
  const esito = valutaRisposta(t, { pezzi: { 100: 3 } }, cassetto);
  assert.equal(esito.corretta, false);
  assert.equal(esito.errore, 'scorte-insufficienti');
});

test('accorgersi che i soldi non bastano e una risposta giusta', () => {
  const scarso = transazione({
    tipoEsercizio: 'conta',
    ricevuto: 1000,
    resto: 0,
    bastano: false,
    mancano: 240,
    pezziPorti: { 500: 1, 200: 2, 100: 1 },
  });

  const giusta = valutaRisposta(scarso, { pezzi: {}, nonBasta: true });
  assert.ok(giusta.corretta);
  assert.match(giusta.messaggio, /2,40 €/);
  assert.equal(giusta.mostraResto, false, 'non c e nessun resto da mostrare');

  // Rendere il resto quando il cliente non ha coperto il conto significa non
  // aver contato il mucchio: e' un errore suo, con un nome suo.
  const distratto = valutaRisposta(scarso, { pezzi: { 100: 1 }, nonBasta: false });
  assert.equal(distratto.corretta, false);
  assert.equal(distratto.errore, 'pagamento-insufficiente');
  assert.match(distratto.messaggio, /mancavano/);
});

test('gridare al pagamento insufficiente quando i soldi bastavano e un errore', () => {
  const esito = valutaRisposta(transazione(), { pezzi: {}, nonBasta: true });
  assert.equal(esito.corretta, false);
  assert.match(esito.messaggio, /7,60 €/, 'deve comunque dire quale era il resto');
});

test('chiedere gli spiccioli: la richiesta giusta prende il bonus, il silenzio giusto no', () => {
  // Conto 12,10 € con 20 €: chiedere 10 c porta il resto da 5 pezzi a 3.
  const t = transazione({ tipoEsercizio: 'chiedi-spiccioli', conto: 1210, resto: 790 });

  const ottima = valutaRisposta(t, { chiesti: { 10: 1 } });
  assert.ok(ottima.corretta);
  assert.ok(ottima.minima);
  assert.equal(ottima.etichettaBonus, 'Richiesta azzeccata');
  assert.equal(ottima.ricevutoEffettivo, 2010, 'il feedback deve contare sui soldi davvero in mano');

  const persa = valutaRisposta(t, { chiesti: {} });
  assert.equal(persa.corretta, false);
  assert.equal(persa.errore, 'spicciolo-sbagliato');

  // Qui il resto e' gia' pulito: la risposta giusta e' non chiedere niente,
  // ma non e' una prodezza da premiare col bonus.
  const pulito = transazione({ tipoEsercizio: 'chiedi-spiccioli', conto: 1250, resto: 750 });
  const silenzio = valutaRisposta(pulito, { chiesti: {} });
  assert.ok(silenzio.corretta);
  assert.equal(silenzio.minima, false);
});

test('ogni esito ha un titolo e un messaggio leggibili, mai NaN o undefined', () => {
  const cassetto = creaCassetto(FONDO_CASSA_INIZIALE);
  const casi = [
    [transazione(), { pezzi: { 500: 1, 200: 1, 50: 1, 10: 1 } }],
    [transazione(), { pezzi: { 500: 1 } }],
    [transazione(), { pezzi: {}, nonBasta: true }],
    [transazione({ tipoEsercizio: 'conta', pezziPorti: { 2000: 1, 100: 1 }, ricevuto: 2100, resto: 860 }), { pezzi: { 500: 1 } }],
    [transazione({ tipoEsercizio: 'ricevi-spiccioli', spiccioliAggiunti: { 10: 1 } }), { pezzi: { 500: 1, 200: 1, 50: 1, 10: 1 } }],
    [transazione({ tipoEsercizio: 'chiedi-spiccioli' }), { chiesti: { 20: 1 } }],
  ];
  for (const [t, risposta] of casi) {
    const esito = valutaRisposta(t, risposta, cassetto);
    for (const campo of ['titolo', 'messaggio']) {
      assert.equal(typeof esito[campo], 'string', `${t.tipoEsercizio}: ${campo} non e una stringa`);
      assert.ok(!esito[campo].includes('NaN'), `${t.tipoEsercizio}: ${campo} contiene NaN`);
      assert.ok(!esito[campo].includes('undefined'), `${t.tipoEsercizio}: ${campo} contiene undefined`);
    }
    assert.ok(esito.titolo.length > 0, `${t.tipoEsercizio}: titolo vuoto`);
  }
});
