import test from 'node:test';
import assert from 'node:assert/strict';

import { calcolaPunti, moltiplicatoreStreak, PUNTI_CORRETTA } from '../src/utils/punteggio.js';
import {
  statisticheVuote, registraEsito, precisione, tempoMediano,
  erroreRicorrente, puoAvanzare, avanzaLivello, riassunto, chiudiPartita, cambiaDifficolta,
} from '../src/utils/statistiche.js';
import { LIVELLO_MASSIMO, DIFFICOLTA } from '../src/data/livelli.js';
import { creaCassetto, registraTransazione, chiusuraCassa, preleva } from '../src/utils/cassetto.js';
import { FONDO_CASSA_INIZIALE } from '../src/data/valuta.js';

test('sbagliare non toglie punti, ne fa solo mancare', () => {
  assert.equal(calcolaPunti({ corretta: false, streak: 9 }).punti, 0);
});

test('la risposta giusta vale la base, e la velocita e i pezzi minimi la aumentano', () => {
  const secca = calcolaPunti({ corretta: true });
  assert.equal(secca.punti, PUNTI_CORRETTA);

  const veloce = calcolaPunti({ corretta: true, msImpiegati: 0, secondiTimer: 20 });
  assert.ok(veloce.punti > secca.punti);

  const lenta = calcolaPunti({ corretta: true, msImpiegati: 20000, secondiTimer: 20 });
  assert.equal(lenta.punti, PUNTI_CORRETTA, 'a tempo scaduto il bonus velocita e zero');

  const minima = calcolaPunti({ corretta: true, minima: true });
  assert.ok(minima.punti > secca.punti);
});

test('il moltiplicatore della serie si ferma alla decima', () => {
  assert.equal(moltiplicatoreStreak(0), 1);
  assert.ok(Math.abs(moltiplicatoreStreak(5) - 1.5) < 1e-9);
  assert.ok(Math.abs(moltiplicatoreStreak(10) - 2) < 1e-9);
  assert.ok(Math.abs(moltiplicatoreStreak(50) - 2) < 1e-9);
});

test('le statistiche accumulano tentativi, tempi ed errori per esercizio', () => {
  let stats = statisticheVuote();
  stats = registraEsito(stats, { esercizio: 'conta', corretta: true, msImpiegati: 4000 });
  stats = registraEsito(stats, { esercizio: 'conta', corretta: false, msImpiegati: 9000, errore: 'cifra-sbagliata' });
  stats = registraEsito(stats, { esercizio: 'conta', corretta: true, msImpiegati: 6000 });

  const voce = stats.perEsercizio.conta;
  assert.equal(voce.tentativi, 3);
  assert.equal(voce.corrette, 2);
  assert.ok(Math.abs(precisione(voce) - 2 / 3) < 1e-9);
  assert.equal(tempoMediano(voce), 6000);
  assert.deepEqual(erroreRicorrente(voce), { chiave: 'cifra-sbagliata', etichetta: 'Resto sbagliato', quante: 1 });
});

test('la lista dei tempi non cresce senza limite', () => {
  let stats = statisticheVuote();
  for (let i = 0; i < 200; i++) {
    stats = registraEsito(stats, { esercizio: 'componi', corretta: true, msImpiegati: i });
  }
  assert.equal(stats.perEsercizio.componi.tempi.length, 50);
  assert.equal(stats.perEsercizio.componi.tentativi, 200);
});

test('in modalita difficile si avanza solo con abbastanza risposte giuste e abbastanza precisione', () => {
  const difficile = () => cambiaDifficolta(statisticheVuote(), 'difficile');
  let poche = difficile();
  for (let i = 0; i < DIFFICOLTA.difficile.corrette - 1; i++) {
    poche = registraEsito(poche, { esercizio: 'conta', corretta: true });
  }
  assert.equal(puoAvanzare(poche), false, 'servono le risposte giuste richieste');

  let impreciso = difficile();
  for (let i = 0; i < DIFFICOLTA.difficile.corrette; i++) {
    impreciso = registraEsito(impreciso, { esercizio: 'conta', corretta: true });
  }
  for (let i = 0; i < 20; i++) {
    impreciso = registraEsito(impreciso, { esercizio: 'conta', corretta: false, errore: 'cifra-sbagliata' });
  }
  assert.equal(puoAvanzare(impreciso), false, 'la precisione conta quanto il numero di risposte');

  let pronto = difficile();
  for (let i = 0; i < DIFFICOLTA.difficile.corrette; i++) {
    pronto = registraEsito(pronto, { esercizio: 'conta', corretta: true });
  }
  assert.ok(puoAvanzare(pronto));

  const salito = avanzaLivello(pronto);
  assert.equal(salito.livelloRaggiunto, 2);
  assert.equal(salito.correttePerLivello, 0, 'il conteggio riparte a ogni livello');
});

test('il livello non supera mai il massimo', () => {
  let stats = { ...statisticheVuote(), livelloRaggiunto: LIVELLO_MASSIMO };
  stats = avanzaLivello(stats);
  assert.equal(stats.livelloRaggiunto, LIVELLO_MASSIMO);
  assert.equal(puoAvanzare(stats), false);
});

test('il riassunto mette per primo l esercizio piu debole', () => {
  let stats = statisticheVuote();
  for (let i = 0; i < 10; i++) stats = registraEsito(stats, { esercizio: 'conta', corretta: true });
  for (let i = 0; i < 10; i++) {
    stats = registraEsito(stats, { esercizio: 'componi', corretta: i < 3, errore: i < 3 ? null : 'cifra-sbagliata' });
  }
  const righe = riassunto(stats);
  assert.equal(righe[0].chiave, 'componi');
  assert.equal(righe[0].precisione, 0.3);
  // gli esercizi mai provati finiscono in fondo, non in testa
  assert.equal(righe.at(-1).tentativi, 0);
});

test('chiudiPartita tiene i record senza abbassarli', () => {
  let stats = chiudiPartita(statisticheVuote(), { punteggio: 900, streakMassima: 7 });
  assert.equal(stats.migliorPunteggio, 900);
  stats = chiudiPartita(stats, { punteggio: 300, streakMassima: 2 });
  assert.equal(stats.migliorPunteggio, 900);
  assert.equal(stats.migliorStreak, 7);
  assert.equal(stats.partiteGiocate, 2);
});

test('il cassetto si svuota davvero e la chiusura quadra', () => {
  const iniziale = creaCassetto(FONDO_CASSA_INIZIALE);
  // Conto 12,00 € pagato con 20 €: incassiamo la banconota e rendiamo 5 + 2 + 1.
  const dopo = registraTransazione(iniziale, { 2000: 1 }, { 500: 1, 200: 1, 100: 1 });
  assert.equal(dopo[2000], iniziale[2000] + 1);
  assert.equal(dopo[500], iniziale[500] - 1);

  const chiusura = chiusuraCassa(iniziale, dopo, 1200);
  assert.ok(chiusura.quadra);
  assert.equal(chiusura.differenza, 0);
});

test('non si puo prelevare piu di quello che c e in cassetto', () => {
  const cassetto = creaCassetto({ 500: 1 });
  assert.equal(preleva(cassetto, { 500: 2 }), null);
  assert.deepEqual(preleva(cassetto, { 500: 1 })[500], 0);
});

test('la chiusura segnala i tagli esauriti a fine turno', () => {
  const iniziale = creaCassetto({ 500: 2, 100: 1 });
  const finale = creaCassetto({ 500: 2, 100: 0 });
  const chiusura = chiusuraCassa(iniziale, finale, -100);
  assert.ok(chiusura.quadra);
  assert.deepEqual(chiusura.esauriti.map(t => t.valore), [100]);
});
