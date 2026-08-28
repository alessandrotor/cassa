/**
 * La progressione: si aggiunge una difficoltà alla volta, e ogni livello
 * introduce al massimo un esercizio nuovo. Il timer si stringe solo dopo che
 * il gesto è diventato familiare.
 *
 * Si risponde sempre prendendo i soldi dal cassetto, mai digitando una cifra:
 * in cassa il gesto è quello, e allenare le dita insieme alla testa è il punto.
 */

export const ESERCIZI = {
  componi: {
    chiave: 'componi',
    nome: 'Dai il resto',
    descrizione: 'Prendi dal cassetto le banconote e le monete giuste.',
  },
  conta: {
    chiave: 'conta',
    nome: 'Conta e rendi',
    descrizione: 'Il cliente posa una manciata di soldi: il totale non te lo diciamo.',
  },
  'ricevi-spiccioli': {
    chiave: 'ricevi-spiccioli',
    nome: 'Il cliente aggiunge spiccioli',
    descrizione: 'Paga con una banconota e qualche moneta: non farti confondere.',
  },
  'chiedi-spiccioli': {
    chiave: 'chiedi-spiccioli',
    nome: 'Chiedi gli spiccioli',
    descrizione: 'Conviene chiedere una moneta per semplificare il resto?',
  },
};

export const LIVELLI = [
  {
    numero: 1,
    nome: 'Cifre tonde',
    sottotitolo: 'Conti senza centesimi, si paga con una banconota.',
    esercizi: ['componi'],
    formaConto: 'tondo',
    contoMin: 100,
    contoMax: 1800,
    secondiTimer: 45,
  },
  {
    numero: 2,
    nome: 'Mezzi euro',
    sottotitolo: 'Compaiono i 50 centesimi.',
    esercizi: ['componi'],
    formaConto: 'mezzo',
    contoMin: 150,
    contoMax: 2500,
    secondiTimer: 45,
  },
  {
    numero: 3,
    nome: 'Centesimi veri',
    sottotitolo: 'Prezzi come quelli sullo scaffale: 4,99, 7,30, 12,45.',
    esercizi: ['componi'],
    formaConto: 'realistico',
    contoMin: 150,
    contoMax: 3500,
    secondiTimer: 40,
  },
  {
    numero: 4,
    nome: 'Conta il mucchio',
    sottotitolo: 'Il cliente posa banconota e monete, e il totale te lo conti tu.',
    esercizi: ['componi', 'conta'],
    formaConto: 'realistico',
    contoMin: 200,
    contoMax: 4000,
    secondiTimer: 40,
  },
  {
    numero: 5,
    nome: 'Spiccioli in arrivo',
    sottotitolo: 'Il cliente aggiunge monete per arrotondare: 20,10 € per 12,10 €.',
    esercizi: ['componi', 'conta', 'ricevi-spiccioli'],
    formaConto: 'realistico',
    contoMin: 200,
    contoMax: 4000,
    secondiTimer: 35,
  },
  {
    numero: 6,
    nome: 'Sei tu a chiedere',
    sottotitolo: 'Decidi se e quale moneta chiedere per semplificare il resto.',
    esercizi: ['componi', 'conta', 'ricevi-spiccioli', 'chiedi-spiccioli'],
    formaConto: 'realistico',
    contoMin: 200,
    contoMax: 4500,
    secondiTimer: 35,
  },
  {
    numero: 7,
    nome: 'Ora di punta',
    sottotitolo: 'Tutto insieme, con la coda che preme.',
    esercizi: ['componi', 'conta', 'ricevi-spiccioli', 'chiedi-spiccioli'],
    formaConto: 'realistico',
    contoMin: 200,
    contoMax: 4800,
    secondiTimer: 25,
  },
];

/**
 * Due modi di misurare se sei pronto per il livello dopo. Cambia solo questo
 * fra facile e difficile: gli esercizi e i tempi restano identici.
 *
 * La differenza vera è cosa succede a un avvio storto. In modalità difficile la
 * precisione si misura su tutto il livello, quindi gli errori dei primi clienti
 * pesano fino alla fine: dopo cinque sbagliate servono venti risposte giuste per
 * tornare all'80%. In modalità facile conta solo la finestra recente, così gli
 * errori vecchi scivolano via e a contare è come stai andando adesso.
 */
export const DIFFICOLTA = {
  facile: {
    chiave: 'facile',
    nome: 'Facile',
    regola: '10 risposte giuste nelle ultime 15',
    descrizione: 'Contano solo le ultime 15 risposte: un avvio storto non ti insegue.',
    corrette: 10,
    finestra: 15,
    precisione: null,
  },
  difficile: {
    chiave: 'difficile',
    nome: 'Difficile',
    regola: "10 risposte giuste con l'80% di precisione",
    descrizione: 'La precisione si misura su tutto il livello: ogni errore pesa fino alla fine.',
    corrette: 10,
    finestra: null,
    precisione: 0.8,
  },
};

export const DIFFICOLTA_PREDEFINITA = 'facile';

/** La finestra più lunga fra le difficoltà: quanti esiti val la pena ricordare. */
export const FINESTRA_MASSIMA = Math.max(
  ...Object.values(DIFFICOLTA).map(d => d.finestra ?? 0),
);

export function difficolta(chiave) {
  return DIFFICOLTA[chiave] ?? DIFFICOLTA[DIFFICOLTA_PREDEFINITA];
}

export const LIVELLO_MASSIMO = LIVELLI.length;

export function livello(numero) {
  const indice = Math.min(Math.max(numero, 1), LIVELLO_MASSIMO) - 1;
  return LIVELLI[indice];
}

/** Un livello libero che mescola tutto: serve alla modalità Turno e all'allenamento mirato. */
export function livelloLibero(esercizi = Object.keys(ESERCIZI), secondiTimer = 0) {
  return {
    numero: 0,
    nome: 'Allenamento libero',
    sottotitolo: 'Nessun timer, nessuna fretta.',
    esercizi,
    formaConto: 'realistico',
    contoMin: 150,
    contoMax: 4500,
    secondiTimer,
  };
}
