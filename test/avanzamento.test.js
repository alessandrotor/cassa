import test from 'node:test';
import assert from 'node:assert/strict';

import {
  statisticheVuote, registraEsito, puoAvanzare, avanzaLivello,
  progressoLivello, cambiaDifficolta, regolaAvanzamento,
} from '../src/utils/statistiche.js';
import { DIFFICOLTA, LIVELLO_MASSIMO } from '../src/data/livelli.js';

/** Costruisce uno stato di livello con tante giuste e tante sbagliate. */
function dopo(modo, giuste, sbagliate) {
  let stats = cambiaDifficolta(statisticheVuote(), modo);
  for (let i = 0; i < giuste; i++) stats = registraEsito(stats, { esercizio: 'componi', corretta: true });
  for (let i = 0; i < sbagliate; i++) stats = registraEsito(stats, { esercizio: 'componi', corretta: false });
  return stats;
}

test('il numero annunciato coincide col momento in cui si sale, in tutte e due le difficolta', () => {
  // La promessa piu' delicata dell'interfaccia: se dice "ancora 3", dopo tre
  // risposte giuste si deve salire davvero, e dopo due no.
  for (const modo of Object.keys(DIFFICOLTA)) {
    for (let giuste = 0; giuste <= 20; giuste++) {
      for (let sbagliate = 0; sbagliate <= 8; sbagliate++) {
        const stats = dopo(modo, giuste, sbagliate);
        const { giusteMancanti } = progressoLivello(stats);
        const caso = `${modo}: ${giuste} giuste, ${sbagliate} sbagliate`;

        assert.equal(puoAvanzare(stats), giusteMancanti === 0, `${caso}: promessa e realta non coincidono`);
        if (giusteMancanti === 0) continue;

        let quasi = stats;
        for (let i = 0; i < giusteMancanti - 1; i++) {
          quasi = registraEsito(quasi, { esercizio: 'componi', corretta: true });
        }
        assert.equal(puoAvanzare(quasi), false, `${caso}: ne bastavano meno di ${giusteMancanti}`);

        const arrivato = registraEsito(quasi, { esercizio: 'componi', corretta: true });
        assert.ok(puoAvanzare(arrivato), `${caso}: dopo ${giusteMancanti} giuste non e salito`);
      }
    }
  }
});

test('in modalita difficile ogni errore alza l asticella', () => {
  const pulito = dopo('difficile', 7, 0);
  assert.equal(progressoLivello(pulito).giusteMancanti, 3);

  const conErrori = dopo('difficile', 7, 3);
  const esito = progressoLivello(conErrori);
  assert.ok(esito.giusteMancanti > 3, 'dopo tre errori devono servirne piu di tre');
  assert.equal(esito.sbagliate, 3);
  assert.ok(Math.abs(esito.precisione - 0.7) < 1e-9);
});

test('in modalita facile un avvio storto non pesa: conta solo la finestra recente', () => {
  const richieste = DIFFICOLTA.facile.corrette;

  const storto = dopo('facile', 0, 3);
  assert.equal(
    progressoLivello(storto).giusteMancanti,
    richieste,
    'tre errori iniziali non devono costare nemmeno una risposta in piu',
  );

  const stessiErroriDifficile = dopo('difficile', 0, 3);
  assert.ok(
    progressoLivello(stessiErroriDifficile).giusteMancanti > richieste,
    'la modalita difficile deve essere davvero piu severa',
  );
});

test('la finestra dimentica sul serio: dieci giuste di fila bastano comunque', () => {
  // Venti errori all'inizio e poi dieci risposte giuste: in modalita facile si
  // sale, perche' gli errori sono usciti dalla finestra.
  let stats = dopo('facile', 0, 20);
  for (let i = 0; i < DIFFICOLTA.facile.corrette; i++) {
    stats = registraEsito(stats, { esercizio: 'componi', corretta: true });
  }
  assert.ok(puoAvanzare(stats), 'dieci giuste di fila devono bastare');
  assert.equal(stats.correttePerLivello, 10);
  assert.equal(stats.tentativiPerLivello, 30, 'il conteggio totale resta comunque registrato');
});

test('la facile non e mai piu severa della difficile', () => {
  for (let giuste = 0; giuste <= 14; giuste++) {
    for (let sbagliate = 0; sbagliate <= 8; sbagliate++) {
      const facile = progressoLivello(dopo('facile', giuste, sbagliate)).giusteMancanti;
      const difficile = progressoLivello(dopo('difficile', giuste, sbagliate)).giusteMancanti;
      assert.ok(
        facile <= difficile,
        `con ${giuste} giuste e ${sbagliate} sbagliate la facile ne chiede ${facile}, la difficile ${difficile}`,
      );
    }
  }
});

test('cambiare difficolta non perde il progresso del livello', () => {
  const facile = dopo('facile', 6, 0);
  const passata = cambiaDifficolta(facile, 'difficile');

  assert.equal(regolaAvanzamento(passata).chiave, 'difficile');
  assert.equal(passata.correttePerLivello, 6, 'le risposte gia date restano contate');
  assert.equal(passata.tentativiPerLivello, 6);
  assert.equal(progressoLivello(passata).giusteMancanti, 4);

  assert.equal(regolaAvanzamento(cambiaDifficolta(passata, 'facile')).chiave, 'facile');
});

test('una chiave di difficolta sconosciuta ricade sulla predefinita', () => {
  assert.equal(regolaAvanzamento({ difficolta: 'inventata' }).chiave, 'facile');
  assert.equal(regolaAvanzamento({}).chiave, 'facile');
  assert.equal(regolaAvanzamento(null).chiave, 'facile');
});

test('salendo di livello la finestra riparte pulita', () => {
  const stats = avanzaLivello(dopo('facile', 10, 2));
  assert.equal(stats.livelloRaggiunto, 2);
  assert.deepEqual(stats.esitiPerLivello, [], 'gli esiti del livello vecchio non devono seguirti');
  assert.equal(stats.correttePerLivello, 0);
  assert.equal(progressoLivello(stats).giusteMancanti, DIFFICOLTA.facile.corrette);
});

test('a livello massimo non c e piu niente da sbloccare, in nessuna difficolta', () => {
  for (const modo of Object.keys(DIFFICOLTA)) {
    const stats = { ...dopo(modo, 20, 0), livelloRaggiunto: LIVELLO_MASSIMO };
    assert.ok(progressoLivello(stats).alMassimo);
    assert.equal(puoAvanzare(stats), false);
  }
});

test('le vecchie statistiche senza finestra ne difficolta non fanno esplodere niente', () => {
  // Un salvataggio fatto prima che esistessero le due modalita'.
  const vecchie = {
    versione: 2,
    perEsercizio: {},
    livelloRaggiunto: 2,
    correttePerLivello: 4,
    tentativiPerLivello: 5,
    migliorPunteggio: 300,
    migliorStreak: 3,
    partiteGiocate: 1,
  };
  assert.equal(regolaAvanzamento(vecchie).chiave, 'facile');
  const progresso = progressoLivello(vecchie);
  assert.ok(progresso.giusteMancanti > 0);
  assert.equal(puoAvanzare(vecchie), false);

  const dopoUnaGiusta = registraEsito(vecchie, { esercizio: 'componi', corretta: true });
  assert.deepEqual(dopoUnaGiusta.esitiPerLivello, [true]);
});
