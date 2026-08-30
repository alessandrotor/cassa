import test from 'node:test';
import assert from 'node:assert/strict';

import { OBIETTIVI, obiettivo } from '../src/data/obiettivi.js';
import { VALORI_RESTO, FONDO_CASSA_INIZIALE, MONETA_MASSIMA } from '../src/data/valuta.js';
import { restoOttimale, creaTabellaResti, leggiTabella } from '../src/utils/resto.js';
import { contaMonete, contaPezzi, sommaPezzi } from '../src/utils/soldi.js';
import { suggerisciSpiccioli, valutaRichiesta } from '../src/utils/spiccioli.js';
import { valutaRisposta } from '../src/utils/valutazione.js';
import { creaCassetto, bilancioMonete, chiusuraCassa, registraTransazione } from '../src/utils/cassetto.js';
import { livelloLibero } from '../src/data/livelli.js';
import { creaRng, generaTransazione } from '../src/utils/generatore.js';

/** Un portafoglio ben fornito: i test non devono dipendere dalla fortuna. */
const PORTAFOGLIO = { 2000: 1, 200: 2, 100: 2, 50: 2, 20: 2, 10: 2, 5: 2, 2: 2, 1: 2 };

test('la moneta piu grande vale meno della banconota piu piccola', () => {
  // È la ragione per cui il minimo di pezzi cede già il minimo di monete: il
  // greedy usa le banconote finché può. Se un giorno cambiassero i tagli,
  // questo test cadrebbe prima che cada il ragionamento costruito sopra.
  const banconotaMinima = Math.min(...VALORI_RESTO.filter(v => v > MONETA_MASSIMA));
  assert.ok(MONETA_MASSIMA < banconotaMinima, `${MONETA_MASSIMA} non è minore di ${banconotaMinima}`);
});

test('comporre col minimo dei pezzi cede sempre anche il minimo delle monete', () => {
  // Il minimo assoluto di monete, calcolato a parte: se divergesse dal minimo
  // di pezzi, la modalità "salva le monete" dovrebbe cambiare anche il modo di
  // comporre il resto, e non solo la decisione di chiedere spiccioli.
  const minimoMonete = cent => {
    const costo = new Array(cent + 1).fill(Infinity);
    costo[0] = 0;
    for (const v of VALORI_RESTO) {
      for (let i = v; i <= cent; i++) {
        const c = costo[i - v] + (v <= MONETA_MASSIMA ? 1 : 0);
        if (c < costo[i]) costo[i] = c;
      }
    }
    return costo[cent];
  };
  for (let cent = 1; cent <= 3000; cent++) {
    assert.equal(
      contaMonete(restoOttimale(cent).pezzi),
      minimoMonete(cent),
      `su ${cent} il minimo di pezzi non cede il minimo di monete`,
    );
  }
});

test('salva-monete porta il resto a una cifra pagabile in banconote', () => {
  // Resto 14,55 €: chiedere 50 centesimi riduce i pezzi ma lascia monete;
  // chiederne 45 porta il resto a 15,00 €, due banconote e nessuna moneta.
  const conto = 545;
  const ricevuto = 2000;

  const pezzi = suggerisciSpiccioli(conto, ricevuto, PORTAFOGLIO, null, { obiettivo: 'meno-pezzi' });
  const monete = suggerisciSpiccioli(conto, ricevuto, PORTAFOGLIO, null, { obiettivo: 'salva-monete' });

  assert.ok(pezzi.conviene && monete.conviene);
  assert.notEqual(pezzi.importoChiesto, monete.importoChiesto, 'le due strategie devono divergere');
  assert.equal(monete.restoDopo % 500, 0, 'il resto deve diventare pagabile in banconote');
  assert.equal(monete.moneteDopo, 0, 'non deve uscire nemmeno una moneta');
  assert.ok(pezzi.moneteDopo > 0, 'la strategia dei pezzi lascia monete sul tavolo');
});

test('salva-monete chiede anche dove i pezzi non lo giustificherebbero', () => {
  // Resto 3,00 € = 2 € + 1 €: due monete, due pezzi. Chiedere il 2 € porta il
  // resto a 5,00 €, una banconota sola. Per i pezzi il guadagno è troppo poco
  // per disturbare il cliente; per le monete vale tre monete salvate.
  const pezzi = suggerisciSpiccioli(1700, 2000, PORTAFOGLIO, null, { obiettivo: 'meno-pezzi' });
  const monete = suggerisciSpiccioli(1700, 2000, PORTAFOGLIO, null, { obiettivo: 'salva-monete' });

  assert.equal(pezzi.conviene, false);
  assert.ok(monete.conviene);
  assert.equal(monete.importoChiesto, 200);
  assert.equal(monete.moneteDopo, 0);
});

test('nessuno dei due obiettivi chiede quando non c e niente da guadagnare', () => {
  // Resto 5,00 €: già una banconota sola e zero monete.
  for (const chiave of Object.keys(OBIETTIVI)) {
    const esito = suggerisciSpiccioli(1500, 2000, PORTAFOGLIO, null, { obiettivo: chiave });
    assert.equal(esito.conviene, false, `${chiave} disturba il cliente per niente`);
  }
});

test('salva-monete non suggerisce mai una mossa che cede piu monete', () => {
  for (let conto = 100; conto <= 1990; conto += 5) {
    const esito = suggerisciSpiccioli(conto, 2000, PORTAFOGLIO, null, { obiettivo: 'salva-monete' });
    if (!esito.conviene) continue;
    assert.ok(
      esito.moneteDopo < esito.monetePrima,
      `su conto ${conto} suggerisce di chiedere senza salvare monete`,
    );
    assert.equal(esito.restoDopo, 2000 + esito.importoChiesto - conto);
  }
});

test('i messaggi parlano di monete quando l obiettivo e salvarle', () => {
  const conto = 1700;
  const opzioni = { obiettivo: 'salva-monete' };
  const giusta = valutaRichiesta({ 200: 1 }, conto, 2000, PORTAFOGLIO, null, opzioni);
  assert.equal(giusta.verdetto, 'ottima');
  assert.match(giusta.messaggio, /monet/, `messaggio senza monete: ${giusta.messaggio}`);

  const persa = valutaRichiesta({}, conto, 2000, PORTAFOGLIO, null, opzioni);
  assert.equal(persa.verdetto, 'occasione-persa');
  assert.match(persa.messaggio, /monet/);

  // Con l'altro obiettivo si torna a parlare di pezzi.
  const pezzi = valutaRichiesta({ 10: 1 }, 1210, 2000, PORTAFOGLIO, null, { obiettivo: 'meno-pezzi' });
  assert.match(pezzi.messaggio, /pezz/);
});

test('rendere il resto in monete quando bastava una banconota viene ripreso', () => {
  const transazione = {
    id: 'prova', tipoEsercizio: 'componi', conto: 1500, ricevuto: 2000, resto: 500,
    bastano: true, mancano: 0, portafoglioCliente: PORTAFOGLIO, pezziPorti: { 2000: 1 },
    composizioneResto: restoOttimale(500).pezzi, spiccioliAggiunti: null, suggerimento: null,
  };
  const inMonete = { pezzi: { 200: 2, 100: 1 }, dichiarazione: null };

  const esito = valutaRisposta(transazione, inMonete, null, { obiettivo: 'salva-monete' });
  assert.ok(esito.corretta, 'la cifra è giusta');
  assert.ok(esito.parziale, 'ma va segnalata');
  assert.equal(esito.errore, 'monete-sprecate');
  assert.match(esito.messaggio, /3 monete/);

  // Con la banconota il verdetto è pieno, e il messaggio lo dice in monete.
  const conBanconota = valutaRisposta(transazione, { pezzi: { 500: 1 }, dichiarazione: null }, null, { obiettivo: 'salva-monete' });
  assert.ok(conBanconota.corretta && conBanconota.minima);
  assert.match(conBanconota.messaggio, /banconote/);
  assert.equal(conBanconota.etichettaBonus, OBIETTIVI['salva-monete'].bonus);
});

test('il bilancio delle monete misura quello che resta al collega', () => {
  const iniziale = creaCassetto({ 1000: 2, 200: 3, 100: 2, 50: 1, 10: 0 });
  // Incassiamo una banconota e rendiamo monete: le monete calano.
  const finale = registraTransazione(iniziale, { 1000: 1 }, { 200: 2, 100: 1, 50: 1 });

  const bilancio = bilancioMonete(iniziale, finale);
  assert.equal(bilancio.prima, 6);
  assert.equal(bilancio.dopo, 2);
  assert.equal(bilancio.differenza, -4);
  assert.deepEqual(bilancio.prosciugati.map(t => t.valore), [50], 'i 50 c c erano e sono finiti');

  // Un taglio mai avuto non e' un fatto del turno.
  assert.ok(!bilancio.prosciugati.some(t => t.valore === 10));
});

test('la chiusura di cassa porta con se il bilancio delle monete', () => {
  const iniziale = creaCassetto(FONDO_CASSA_INIZIALE);
  const finale = registraTransazione(iniziale, { 2000: 1 }, { 500: 1, 200: 1, 100: 1 });
  const chiusura = chiusuraCassa(iniziale, finale, 1200);

  assert.ok(chiusura.quadra);
  assert.equal(chiusura.monete.differenza, -2, 'sono uscite la moneta da 2 € e quella da 1 €');
  assert.equal(chiusura.monete.perTaglio.length, 8);
});

test('un obiettivo sconosciuto ricade su quello predefinito', () => {
  assert.equal(obiettivo('inventato').chiave, 'meno-pezzi');
  assert.equal(obiettivo(undefined).chiave, 'meno-pezzi');
  assert.equal(obiettivo(null).chiave, 'meno-pezzi');
});

test('il generatore passa l obiettivo al suggerimento, e i round restano risolvibili', () => {
  const cassetto = creaCassetto(FONDO_CASSA_INIZIALE);
  for (const chiave of Object.keys(OBIETTIVI)) {
    const rng = creaRng(2026);
    const liv = livelloLibero(['chiedi-spiccioli']);
    for (let i = 0; i < 200; i++) {
      const t = generaTransazione(liv, { cassetto, rng, tipoForzato: 'chiedi-spiccioli', obiettivo: chiave });
      if (t.ripiego) continue;
      assert.equal(t.suggerimento.obiettivo, chiave, 'il suggerimento ignora l obiettivo');
      const risposta = { chiesti: t.suggerimento.conviene ? t.suggerimento.daChiedere : {} };
      assert.ok(
        valutaRisposta(t, risposta, cassetto, { obiettivo: chiave }).corretta,
        `${chiave}: la mossa suggerita non risulta corretta`,
      );
    }
  }
});
