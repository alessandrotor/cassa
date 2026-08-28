import {
  ESERCIZI, LIVELLO_MASSIMO,
  difficolta as regolaDi, DIFFICOLTA_PREDEFINITA, FINESTRA_MASSIMA,
} from '../data/livelli.js';

// v2: gli esercizi sono cambiati quando e' sparito il tastierino, e i vecchi
// conteggi parlavano di un gioco diverso.
export const CHIAVE_STATISTICHE = 'cassa:stats:v2';

/** I modi in cui si può sbagliare: sapere quale prevale è metà dell'allenamento. */
export const ERRORI = {
  'cifra-sbagliata': 'Resto sbagliato',
  'pagamento-insufficiente': 'Non hai visto che mancavano soldi',
  'composizione-non-minima': 'Troppi pezzi',
  'spicciolo-sbagliato': 'Spiccioli chiesti male',
  'scorte-insufficienti': 'Tagli non disponibili',
  'tempo-scaduto': 'Tempo scaduto',
};

export function statisticheVuote() {
  return {
    versione: 2,
    perEsercizio: Object.fromEntries(
      Object.keys(ESERCIZI).map(chiave => [chiave, esercizioVuoto()]),
    ),
    difficolta: DIFFICOLTA_PREDEFINITA,
    livelloRaggiunto: 1,
    correttePerLivello: 0,
    tentativiPerLivello: 0,
    // Gli ultimi esiti del livello in corso: servono alla regola a finestra.
    esitiPerLivello: [],
    migliorPunteggio: 0,
    migliorStreak: 0,
    partiteGiocate: 0,
  };
}

function esercizioVuoto() {
  return { tentativi: 0, corrette: 0, minime: 0, tempi: [], errori: {} };
}

/**
 * Registra l'esito di una singola transazione. Funzione pura: prende le
 * statistiche e ne restituisce di nuove, così React le tratta come qualsiasi
 * altro stato.
 *
 * @param {Object} stats statistiche correnti
 * @param {{ esercizio: string, corretta: boolean, minima?: boolean, msImpiegati?: number, errore?: string|null }} esito
 */
export function registraEsito(stats, { esercizio, corretta, minima = false, msImpiegati = 0, errore = null }) {
  const base = stats ?? statisticheVuote();
  const precedente = base.perEsercizio?.[esercizio] ?? esercizioVuoto();

  const aggiornato = {
    tentativi: precedente.tentativi + 1,
    corrette: precedente.corrette + (corretta ? 1 : 0),
    minime: precedente.minime + (minima ? 1 : 0),
    // Teniamo solo gli ultimi 50 tempi: bastano per una mediana onesta e non
    // fanno crescere il localStorage all'infinito.
    tempi: [...precedente.tempi, msImpiegati].slice(-50),
    errori: errore
      ? { ...precedente.errori, [errore]: (precedente.errori[errore] ?? 0) + 1 }
      : precedente.errori,
  };

  return {
    ...base,
    perEsercizio: { ...base.perEsercizio, [esercizio]: aggiornato },
    correttePerLivello: (base.correttePerLivello ?? 0) + (corretta ? 1 : 0),
    tentativiPerLivello: (base.tentativiPerLivello ?? 0) + 1,
    esitiPerLivello: [...(base.esitiPerLivello ?? []), corretta].slice(-FINESTRA_MASSIMA),
  };
}

/**
 * Un tetto alla simulazione: con la regola difficile, tanti errori iniziali
 * possono richiedere centinaia di risposte giuste, ma oltre questa soglia il
 * numero non e' piu' un'informazione utile ed e' inutile continuare a contarlo.
 */
const LIMITE_SIMULAZIONE = 999;

/** Lo stato del livello in corso, tollerante verso i salvataggi vecchi. */
function statoLivello(stats) {
  return {
    corrette: stats?.correttePerLivello ?? 0,
    tentativi: stats?.tentativiPerLivello ?? 0,
    esiti: stats?.esitiPerLivello ?? [],
  };
}

/** Quale delle due regole di avanzamento è in vigore. */
export function regolaAvanzamento(stats) {
  return regolaDi(stats?.difficolta);
}

export function cambiaDifficolta(stats, chiave) {
  return { ...(stats ?? statisticheVuote()), difficolta: regolaDi(chiave).chiave };
}

export function precisione(voce) {
  if (!voce || voce.tentativi === 0) return null;
  return voce.corrette / voce.tentativi;
}

export function tempoMediano(voce) {
  if (!voce || voce.tempi.length === 0) return null;
  const ordinati = [...voce.tempi].sort((a, b) => a - b);
  const meta = Math.floor(ordinati.length / 2);
  return ordinati.length % 2 === 0
    ? Math.round((ordinati[meta - 1] + ordinati[meta]) / 2)
    : ordinati[meta];
}

/** L'errore che il giocatore fa più spesso in quell'esercizio. */
export function erroreRicorrente(voce) {
  const voci = Object.entries(voce?.errori ?? {});
  if (voci.length === 0) return null;
  const [chiave, quante] = voci.sort((a, b) => b[1] - a[1])[0];
  return { chiave, etichetta: ERRORI[chiave] ?? chiave, quante };
}

/**
 * La regola dell'avanzamento, scritta una volta sola. Tenerla qui evita che il
 * numero mostrato al giocatore e il momento in cui sale di livello si
 * contraddicano.
 *
 * Facile: bastano N giuste fra le ultime della finestra.
 * Difficile: N giuste su tutto il livello, con la precisione richiesta.
 */
function soddisfaSoglia(regola, stato) {
  if (regola.finestra) {
    const finestra = stato.esiti.slice(-regola.finestra);
    return finestra.filter(Boolean).length >= regola.corrette;
  }
  if (stato.corrette < regola.corrette) return false;
  if (stato.tentativi === 0) return false;
  return stato.corrette / stato.tentativi >= regola.precisione;
}

/** Lo stato dopo una risposta giusta in più: serve a contare quante ne mancano. */
function conUnaGiustaInPiu(stato) {
  return {
    corrette: stato.corrette + 1,
    tentativi: stato.tentativi + 1,
    esiti: [...stato.esiti, true].slice(-FINESTRA_MASSIMA),
  };
}

/** Si sale di livello con abbastanza risposte giuste, non con abbastanza tentativi. */
export function puoAvanzare(stats) {
  if (!stats || stats.livelloRaggiunto >= LIVELLO_MASSIMO) return false;
  return soddisfaSoglia(regolaAvanzamento(stats), statoLivello(stats));
}

/**
 * A che punto sei per il livello successivo.
 *
 * Le due condizioni non sono indipendenti: sbagliare non solo non avvicina la
 * soglia delle risposte giuste, ma abbassa la precisione, e per rialzarla
 * servono altre risposte giuste. Per questo l'unico numero onesto da mostrare
 * al giocatore e' `giusteMancanti`: quante ne servono di fila per essere a
 * posto su entrambi i fronti.
 *
 * Da (corrette + x) / (tentativi + x) >= p si ricava x >= (p·tentativi − corrette) / (1 − p).
 */
export function progressoLivello(stats) {
  const base = stats ?? statisticheVuote();
  const regola = regolaAvanzamento(base);
  const stato = statoLivello(base);

  // Contiamo simulando risposte giuste finché la regola vera non è soddisfatta.
  // È più lento di una formula chiusa, ma è l'unico modo perché il numero
  // annunciato e il momento in cui si sale coincidano sempre: con la formula,
  // su valori come 0,8 la virgola mobile faceva annunciare una giusta di troppo.
  let giusteMancanti = 0;
  let simulato = stato;
  while (!soddisfaSoglia(regola, simulato) && giusteMancanti < LIMITE_SIMULAZIONE) {
    simulato = conUnaGiustaInPiu(simulato);
    giusteMancanti++;
  }

  const finestra = regola.finestra ? stato.esiti.slice(-regola.finestra) : null;
  const corretteInFinestra = finestra ? finestra.filter(Boolean).length : null;
  const precisione = stato.tentativi === 0 ? null : stato.corrette / stato.tentativi;

  return {
    regola,
    corrette: stato.corrette,
    tentativi: stato.tentativi,
    sbagliate: stato.tentativi - stato.corrette,
    richieste: regola.corrette,
    finestra: regola.finestra,
    corretteInFinestra,
    rispostePesate: finestra ? finestra.length : stato.tentativi,
    precisione,
    sogliaPrecisione: regola.precisione,
    precisioneInRegola: regola.precisione === null || precisione === null || precisione >= regola.precisione,
    giusteMancanti,
    alMassimo: base.livelloRaggiunto >= LIVELLO_MASSIMO,
  };
}

export function avanzaLivello(stats) {
  return {
    ...stats,
    livelloRaggiunto: Math.min(stats.livelloRaggiunto + 1, LIVELLO_MASSIMO),
    correttePerLivello: 0,
    tentativiPerLivello: 0,
    esitiPerLivello: [],
  };
}

export function chiudiPartita(stats, { punteggio = 0, streakMassima = 0 } = {}) {
  return {
    ...stats,
    partiteGiocate: (stats.partiteGiocate ?? 0) + 1,
    migliorPunteggio: Math.max(stats.migliorPunteggio ?? 0, punteggio),
    migliorStreak: Math.max(stats.migliorStreak ?? 0, streakMassima),
  };
}

/** Riepilogo pronto da mostrare: una riga per esercizio, ordinata dal più debole. */
export function riassunto(stats) {
  const base = stats ?? statisticheVuote();
  return Object.entries(ESERCIZI)
    .map(([chiave, definizione]) => {
      const voce = base.perEsercizio?.[chiave] ?? esercizioVuoto();
      return {
        chiave,
        nome: definizione.nome,
        tentativi: voce.tentativi,
        corrette: voce.corrette,
        precisione: precisione(voce),
        tempoMediano: tempoMediano(voce),
        erroreRicorrente: erroreRicorrente(voce),
      };
    })
    .sort((a, b) => {
      // Prima quello su cui si va peggio: è lì che serve tornare.
      if (a.tentativi === 0) return 1;
      if (b.tentativi === 0) return -1;
      return (a.precisione ?? 1) - (b.precisione ?? 1);
    });
}

/** Legge da localStorage tollerando dati vecchi o corrotti. */
export function caricaStatistiche() {
  try {
    const grezzo = localStorage.getItem(CHIAVE_STATISTICHE);
    if (!grezzo) return statisticheVuote();
    const salvate = JSON.parse(grezzo);
    if (salvate?.versione !== 2) return statisticheVuote();
    return { ...statisticheVuote(), ...salvate, perEsercizio: { ...statisticheVuote().perEsercizio, ...salvate.perEsercizio } };
  } catch {
    return statisticheVuote();
  }
}
