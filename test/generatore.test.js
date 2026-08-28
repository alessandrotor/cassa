import test from 'node:test';
import assert from 'node:assert/strict';

import { LIVELLI, livelloLibero } from '../src/data/livelli.js';
import { creaRng, generaTransazione, generaConto, generaPortafoglio } from '../src/utils/generatore.js';
import { restoOttimale } from '../src/utils/resto.js';
import { sommaPezzi, contaPezzi } from '../src/utils/soldi.js';
import { clientePuoDare } from '../src/utils/spiccioli.js';
import { creaCassetto } from '../src/utils/cassetto.js';
import { FONDO_CASSA_INIZIALE } from '../src/data/valuta.js';

test('ogni livello genera transazioni risolvibili, mille volte di fila', () => {
  for (const liv of LIVELLI) {
    const rng = creaRng(1234 + liv.numero);
    for (let i = 0; i < 1000; i++) {
      const t = generaTransazione(liv, { rng });
      assert.ok(liv.esercizi.includes(t.tipoEsercizio) || t.ripiego,
        `livello ${liv.numero}: esercizio ${t.tipoEsercizio} non previsto`);
      assert.ok(t.conto > 0, `livello ${liv.numero}: conto non positivo`);
      assert.ok(clientePuoDare(t.pezziPorti, t.portafoglioCliente),
        `livello ${liv.numero}: il cliente porge soldi che non ha`);
      assert.equal(sommaPezzi(t.pezziPorti), t.ricevuto);

      if (t.tipoEsercizio === 'conta' && !t.bastano) {
        assert.ok(t.mancano > 0, 'un pagamento insufficiente deve dire quanto manca');
        continue;
      }
      assert.ok(t.bastano, `livello ${liv.numero}: ricevuto ${t.ricevuto} < conto ${t.conto}`);
      assert.equal(t.resto, t.ricevuto - t.conto);
      assert.ok(restoOttimale(t.resto).possibile, `resto ${t.resto} non componibile`);
    }
  }
});

test('con il cassetto limitato il resto resta sempre componibile con le scorte', () => {
  const cassetto = creaCassetto(FONDO_CASSA_INIZIALE);
  const rng = creaRng(99);
  const liv = LIVELLI[6];
  for (let i = 0; i < 500; i++) {
    const t = generaTransazione(liv, { cassetto, rng });
    if (!t.bastano) continue;
    const esito = restoOttimale(t.resto, cassetto);
    assert.ok(esito.possibile, `resto ${t.resto} non componibile col fondo cassa`);
    assert.equal(sommaPezzi(t.composizioneResto), t.resto);
  }
});

test('anche con un cassetto quasi vuoto non produce round irrisolvibili', () => {
  // Restano solo banconote e monete da mezzo euro: il generatore deve
  // scegliere pagamenti che si possano davvero rendere.
  const cassetto = { 5000: 0, 2000: 1, 1000: 1, 500: 2, 200: 0, 100: 2, 50: 2, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 };
  const rng = creaRng(7);
  for (let i = 0; i < 300; i++) {
    const t = generaTransazione(LIVELLI[6], { cassetto, rng });
    if (!t.bastano) continue;
    assert.ok(restoOttimale(t.resto, cassetto).possibile, `resto ${t.resto} non rendibile`);
  }
});

test("nell'esercizio del resto il cliente paga con un pezzo solo", () => {
  // Se pagasse con un mucchio, lo Scontrino nasconderebbe il totale e
  // 'componi' diventerebbe 'conta': i due esercizi devono restare distinti.
  const rng = creaRng(77);
  const liv = livelloLibero(['componi']);
  for (let i = 0; i < 300; i++) {
    const t = generaTransazione(liv, { rng, tipoForzato: 'componi' });
    assert.equal(contaPezzi(t.pezziPorti), 1, `pagamento con ${contaPezzi(t.pezziPorti)} pezzi`);
  }
});

test("nell'esercizio del conteggio il mucchio ha sempre piu di un pezzo", () => {
  const rng = creaRng(78);
  const liv = livelloLibero(['conta']);
  for (let i = 0; i < 300; i++) {
    const t = generaTransazione(liv, { rng, tipoForzato: 'conta' });
    if (t.ripiego) continue;
    assert.ok(contaPezzi(t.pezziPorti) > 1, 'un pezzo solo non e un mucchio da contare');
  }
});

test('i conti tondi sono tondi e i mezzi euro sono mezzi', () => {
  const rng = creaRng(42);
  for (let i = 0; i < 300; i++) {
    assert.equal(generaConto(LIVELLI[0], rng) % 100, 0);
    assert.equal(generaConto(LIVELLI[1], rng) % 50, 0);
  }
});

test('il conto sta dentro i limiti del livello', () => {
  const rng = creaRng(5);
  for (const liv of LIVELLI) {
    for (let i = 0; i < 300; i++) {
      const conto = generaConto(liv, rng);
      assert.ok(conto >= liv.contoMin - 100 && conto <= liv.contoMax + 100,
        `livello ${liv.numero}: conto ${conto} fuori dai limiti`);
    }
  }
});

test('il portafoglio del cliente copre sempre il conto', () => {
  const rng = creaRng(11);
  for (let i = 0; i < 500; i++) {
    const conto = generaConto(LIVELLI[6], rng);
    const portafoglio = generaPortafoglio(conto, rng);
    assert.ok(sommaPezzi(portafoglio) >= conto, `portafoglio troppo magro per ${conto}`);
  }
});

test("l'esercizio 'chiedi-spiccioli' propone sia i casi in cui conviene sia quelli in cui no", () => {
  const rng = creaRng(2026);
  const liv = livelloLibero(['chiedi-spiccioli']);
  let conviene = 0;
  let nonConviene = 0;
  for (let i = 0; i < 300; i++) {
    const t = generaTransazione(liv, { rng, tipoForzato: 'chiedi-spiccioli' });
    if (t.ripiego) continue;
    if (t.suggerimento?.conviene) conviene++;
    else nonConviene++;
  }
  assert.ok(conviene > 30, `troppo pochi casi in cui conviene chiedere (${conviene})`);
  assert.ok(nonConviene > 30, `troppo pochi casi in cui non conviene chiedere (${nonConviene})`);
});

test("nell'esercizio 'ricevi-spiccioli' il cliente aggiunge davvero delle monete", () => {
  const rng = creaRng(808);
  const liv = livelloLibero(['ricevi-spiccioli']);
  let conAggiunta = 0;
  for (let i = 0; i < 200; i++) {
    const t = generaTransazione(liv, { rng, tipoForzato: 'ricevi-spiccioli' });
    if (t.ripiego) continue;
    assert.ok(t.spiccioliAggiunti, 'manca la manciata aggiunta dal cliente');
    assert.ok(sommaPezzi(t.spiccioliAggiunti) > 0);
    assert.ok(clientePuoDare(t.spiccioliAggiunti, t.portafoglioCliente));
    conAggiunta++;
  }
  assert.ok(conAggiunta > 150, `troppi ripieghi: solo ${conAggiunta} round validi su 200`);
});

test("l'esercizio 'conta' produce anche pagamenti insufficienti, ma non troppi", () => {
  const rng = creaRng(31);
  const liv = livelloLibero(['conta']);
  let insufficienti = 0;
  let totali = 0;
  for (let i = 0; i < 400; i++) {
    const t = generaTransazione(liv, { rng, tipoForzato: 'conta' });
    if (t.ripiego) continue;
    totali++;
    if (!t.bastano) insufficienti++;
  }
  assert.ok(insufficienti > 0, 'nessun pagamento insufficiente generato');
  assert.ok(insufficienti < totali * 0.5, 'troppi pagamenti insufficienti');
});

test('lo stesso seme produce la stessa sessione', () => {
  const rngA = creaRng(555);
  const rngB = creaRng(555);
  for (let i = 0; i < 20; i++) {
    const a = generaTransazione(LIVELLI[5], { rng: rngA });
    const b = generaTransazione(LIVELLI[5], { rng: rngB });
    assert.equal(a.conto, b.conto);
    assert.equal(a.ricevuto, b.ricevuto);
    assert.equal(a.tipoEsercizio, b.tipoEsercizio);
  }
});
