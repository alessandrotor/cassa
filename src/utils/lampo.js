import { sommaPezzi, contaPezzi } from './soldi.js';

/**
 * Resto rapido: pochi secondi a cliente, e l'errore è permesso.
 *
 * Non è un esame del gesto come l'allenamento: è un esercizio di conto sotto
 * pressione. Nessuno ferma il round per spiegare, allo scadere del tempo si
 * consegna quello che hai in mano, e alla fine si fanno i conti come alla
 * chiusura di cassa — quanto hai dato in più, quanto in meno.
 */

/** Un turno rapido è corto di proposito: la concentrazione a questo ritmo dura poco. */
export const CLIENTI_PER_SESSIONE_RAPIDA = 20;

/**
 * Il tempo per cliente è fatto di due parti: un tempo fisso per fare il conto
 * a mente, più un attimo per ogni pezzo da toccare. Senza la seconda, un resto
 * da 7,90 € (cinque pezzi) e uno da 5,00 € (uno) avrebbero lo stesso tempo, e
 * il primo sarebbe impossibile per le dita, non per la testa.
 *
 * Il mucchio da contare aggiunge i pezzi posati dal cliente: sommarli fa parte
 * del conto, ed è giusto che abbia il suo tempo.
 */
export const RITMI = {
  calmo: {
    chiave: 'calmo',
    nome: 'Calmo',
    base: 5,
    perPezzo: 0.8,
    descrizione: 'Il tempo per fare il conto con calma e contare i pezzi.',
  },
  svelto: {
    chiave: 'svelto',
    nome: 'Svelto',
    base: 3.5,
    perPezzo: 0.6,
    descrizione: 'Il ritmo di una cassa con la coda: niente pause per pensare.',
  },
  lampo: {
    chiave: 'lampo',
    nome: 'Lampo',
    base: 2.5,
    perPezzo: 0.45,
    descrizione: 'Il conto va fatto a colpo d\'occhio: le mani partono subito.',
  },
};

export const RITMO_PREDEFINITO = 'svelto';

export function ritmo(chiave) {
  return RITMI[chiave] ?? RITMI[RITMO_PREDEFINITO];
}

/** Che prezzi girano: dai conti tondi a quelli da scaffale. */
export const PREZZI = {
  tondo: { chiave: 'tondo', nome: 'Tondi', esempio: '7,00 €', contoMin: 100, contoMax: 1800 },
  mezzo: { chiave: 'mezzo', nome: 'Mezzi euro', esempio: '7,50 €', contoMin: 150, contoMax: 2500 },
  realistico: { chiave: 'realistico', nome: 'Centesimi veri', esempio: '7,35 €', contoMin: 150, contoMax: 4800 },
};

export const PREZZI_PREDEFINITI = 'realistico';

/**
 * Il livello da passare al generatore. Solo esercizi in cui si rende qualcosa
 * (chiedere spiccioli non è un conto), e mai pagamenti che non bastano: qui si
 * misura quanto hai sbagliato a rendere, e un round senza resto da rendere non
 * avrebbe niente da misurare.
 */
export function livelloRapido(chiavePrezzi) {
  const prezzi = PREZZI[chiavePrezzi] ?? PREZZI[PREZZI_PREDEFINITI];
  return {
    numero: 0,
    nome: 'Resto rapido',
    sottotitolo: '',
    esercizi: ['componi', 'componi', 'conta', 'ricevi-spiccioli'],
    formaConto: prezzi.chiave,
    contoMin: prezzi.contoMin,
    contoMax: prezzi.contoMax,
    secondiTimer: 0,
    pagamentiInsufficienti: false,
  };
}

/** Secondi a disposizione per questo cliente, arrotondati al decimo. */
export function secondiPerCliente(chiaveRitmo, transazione) {
  const { base, perPezzo } = ritmo(chiaveRitmo);
  const pezziResto = contaPezzi(transazione.composizioneResto);
  // Il primo pezzo posato dal cliente si legge e basta: si conta dal secondo.
  const pezziDaSommare = Math.max(0, contaPezzi(transazione.pezziPorti) - 1);
  return Math.round((base + perPezzo * (pezziResto + pezziDaSommare)) * 10) / 10;
}

/**
 * Com'è andato un cliente: quanto hai dato contro quanto dovevi.
 * differenza > 0 = hai dato troppo (la cassa ci rimette), < 0 = troppo poco
 * (ci rimette il cliente).
 */
export function esitoRapido(transazione, pezziDati, { msImpiegati = 0, scaduto = false } = {}) {
  const dato = sommaPezzi(pezziDati);
  const differenza = dato - transazione.resto;
  return {
    conto: transazione.conto,
    ricevuto: transazione.ricevuto,
    resto: transazione.resto,
    dato,
    pezziDati: pezziDati ?? {},
    differenza,
    esatto: differenza === 0,
    msImpiegati,
    scaduto,
  };
}

/** Il conto di fine sessione, a partire dagli esiti dei singoli clienti. */
export function riassuntoRapido(esiti) {
  const clienti = esiti.length;
  const esatti = esiti.filter(e => e.esatto).length;
  const inPiu = esiti.filter(e => e.differenza > 0);
  const inMeno = esiti.filter(e => e.differenza < 0);
  const totaleInPiu = inPiu.reduce((s, e) => s + e.differenza, 0);
  const totaleInMeno = inMeno.reduce((s, e) => s - e.differenza, 0);
  const tempi = esiti.filter(e => !e.scaduto).map(e => e.msImpiegati);
  return {
    clienti,
    esatti,
    precisione: clienti > 0 ? esatti / clienti : null,
    volteInPiu: inPiu.length,
    volteInMeno: inMeno.length,
    totaleInPiu,
    totaleInMeno,
    // Quello che la cassa avrebbe a fine sessione rispetto al dovuto:
    // negativo se hai regalato soldi, positivo se ne hai trattenuti.
    saldoCassa: totaleInMeno - totaleInPiu,
    scaduti: esiti.filter(e => e.scaduto).length,
    tempoMedio: tempi.length > 0 ? tempi.reduce((s, t) => s + t, 0) / tempi.length : null,
    peggiore: esiti.reduce(
      (peggio, e) => (Math.abs(e.differenza) > Math.abs(peggio?.differenza ?? 0) ? e : peggio),
      null,
    ),
  };
}
