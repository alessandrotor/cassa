import { VALORI_RESTO } from '../data/valuta.js';
import { sommaPezzi, contaPezzi, normalizzaPezzi, unisciPezzi } from './soldi.js';
import { restoOttimale, creaCalcolatoreResto } from './resto.js';
import { suggerisciSpiccioli } from './spiccioli.js';

/** RNG seedabile: una sessione sospetta si riproduce passando lo stesso seme. */
export function creaRng(seme = Date.now()) {
  let stato = seme >>> 0;
  return function rng() {
    stato |= 0;
    stato = (stato + 0x6d2b79f5) | 0;
    let t = Math.imul(stato ^ (stato >>> 15), 1 | stato);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function interoTra(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function scegli(rng, elementi) {
  return elementi[Math.floor(rng() * elementi.length)];
}

function scegliPesato(rng, coppie) {
  const totale = coppie.reduce((somma, [, peso]) => somma + peso, 0);
  let soglia = rng() * totale;
  for (const [valore, peso] of coppie) {
    soglia -= peso;
    if (soglia <= 0) return valore;
  }
  return coppie[coppie.length - 1][0];
}

/** Centesimi come li si vede davvero su uno scontrino, non uniformi da 0 a 99. */
const CENTESIMI_REALISTICI = [
  [0, 14], [5, 3], [10, 4], [20, 4], [25, 2], [30, 4], [40, 4], [45, 2],
  [49, 4], [50, 12], [60, 3], [70, 3], [75, 2], [80, 4], [85, 2],
  [90, 8], [95, 6], [99, 10],
];

export function generaConto(livello, rng) {
  const { formaConto, contoMin, contoMax } = livello;
  if (formaConto === 'tondo') {
    return interoTra(rng, Math.ceil(contoMin / 100), Math.floor(contoMax / 100)) * 100;
  }
  if (formaConto === 'mezzo') {
    return interoTra(rng, Math.ceil(contoMin / 50), Math.floor(contoMax / 50)) * 50;
  }
  const euro = interoTra(rng, Math.ceil(contoMin / 100), Math.floor(contoMax / 100));
  return euro * 100 + scegliPesato(rng, CENTESIMI_REALISTICI);
}

const BANCONOTE = [500, 1000, 2000, 5000];

/**
 * Un portafoglio plausibile: qualche banconota (almeno una che copre il conto)
 * e una manciata di monete. Non e' un cassetto: nessuno gira con dieci monete
 * da un centesimo.
 */
export function generaPortafoglio(conto, rng) {
  const portafoglio = {};

  // La banconota che copre il conto, piu' eventualmente una piu' grande.
  const coprente = BANCONOTE.find(v => v >= conto) ?? 5000;
  portafoglio[coprente] = 1;
  if (rng() < 0.45) {
    const maggiore = BANCONOTE.filter(v => v > coprente);
    if (maggiore.length > 0) {
      const scelta = scegli(rng, maggiore);
      portafoglio[scelta] = (portafoglio[scelta] ?? 0) + 1;
    }
  }
  if (rng() < 0.35) {
    const minore = BANCONOTE.filter(v => v < coprente);
    if (minore.length > 0) {
      const scelta = scegli(rng, minore);
      portafoglio[scelta] = (portafoglio[scelta] ?? 0) + 1;
    }
  }

  // Le monete in tasca: poche, e quelle piccole ancora meno.
  const monete = [
    [200, 0.45, 2], [100, 0.6, 2], [50, 0.6, 2], [20, 0.65, 3],
    [10, 0.65, 3], [5, 0.45, 2], [2, 0.4, 2], [1, 0.4, 3],
  ];
  for (const [valore, probabilita, massimo] of monete) {
    if (rng() < probabilita) portafoglio[valore] = interoTra(rng, 1, massimo);
  }

  return normalizzaPezzi(portafoglio);
}

/** La banconota piu' piccola che copre il conto: e' quella che la gente tira fuori. */
function banconotaPerPagare(conto, portafoglio, rng) {
  const disponibili = BANCONOTE.filter(v => (portafoglio[v] ?? 0) > 0 && v >= conto);
  if (disponibili.length === 0) return null;
  // Ogni tanto si paga con quella piu' grande, perche' e' quella che si ha in mano.
  if (disponibili.length > 1 && rng() < 0.2) return { [scegli(rng, disponibili.slice(1))]: 1 };
  return { [disponibili[0]]: 1 };
}

/** Una manciata di monete presa dal portafoglio, senza svuotarlo. */
function manciataDiMonete(portafoglio, rng, maxPezzi = 3) {
  const pezzi = {};
  const candidati = [200, 100, 50, 20, 10, 5].filter(v => (portafoglio[v] ?? 0) > 0);
  let rimasti = interoTra(rng, 1, maxPezzi);
  while (rimasti > 0 && candidati.length > 0) {
    const valore = scegli(rng, candidati);
    const gia = pezzi[valore] ?? 0;
    if (gia >= portafoglio[valore]) {
      candidati.splice(candidati.indexOf(valore), 1);
      continue;
    }
    pezzi[valore] = gia + 1;
    rimasti--;
  }
  return normalizzaPezzi(pezzi);
}

/** Il cliente paga esatto: e' sempre una transazione valida, ci serve come rete. */
function pagamentoEsatto(conto, portafoglio) {
  const esito = restoOttimale(conto, portafoglio);
  return esito.possibile ? esito.pezzi : null;
}

const MAX_TENTATIVI = 40;

/** Solo questi due esercizi hanno bisogno del suggerimento gia' pronto. */
const SERVE_SUGGERIMENTO = new Set(['chiedi-spiccioli', 'ricevi-spiccioli']);

/**
 * Genera una transazione giocabile per il livello dato.
 *
 * Invariante: o il cliente copre il conto e il resto e' componibile con il
 * cassetto, oppure la transazione e' un caso di "non basta" generato apposta
 * per l'esercizio 'conta'. Non usciamo mai con un round irrisolvibile.
 *
 * @param {Object} livello voce di LIVELLI (o livelloLibero())
 * @param {{ cassetto?: Object|null, rng?: Function, tipoForzato?: string|null }} opzioni
 */
export function generaTransazione(livello, { cassetto = null, rng = Math.random, tipoForzato = null, obiettivo = null } = {}) {
  const tipo = tipoForzato ?? scegli(rng, livello.esercizi);

  for (let tentativo = 0; tentativo < MAX_TENTATIVI; tentativo++) {
    const candidata = provaTransazione(tipo, livello, cassetto, rng, obiettivo);
    if (candidata) return { ...candidata, meta: { livello: livello.numero, tentativi: tentativo + 1 } };
  }

  return transazioneDiRipiego(tipo, livello, cassetto, rng, obiettivo);
}

/**
 * Rete di sicurezza per i cassetti poveri: invece di sperare che il resto sia
 * componibile, lo scegliamo prima fra quelli che il cassetto sa davvero fare e
 * ricaviamo il conto all'indietro. Il caso peggiore e' il pagamento esatto,
 * che e' sempre valido.
 */
function transazioneDiRipiego(tipo, livello, cassetto, rng, obiettivo) {
  const contoDesiderato = generaConto(livello, rng);
  const portafoglio = generaPortafoglio(contoDesiderato, rng);
  const pezziPorti = banconotaPerPagare(contoDesiderato, portafoglio, rng)
    ?? pagamentoEsatto(contoDesiderato, portafoglio)
    ?? { 5000: 1 };
  const ricevuto = sommaPezzi(pezziPorti);

  const calcolatore = creaCalcolatoreResto(Math.max(0, ricevuto - livello.contoMin), cassetto);
  const resto = restoComponibilePiuVicino(calcolatore, ricevuto - contoDesiderato);
  const conto = ricevuto - resto;

  return {
    ...componiTransazione({
      tipo,
      conto,
      portafoglio,
      pezziPorti,
      ricevuto,
      cassetto,
      obiettivo,
      ripiego: true,
    }),
    meta: { livello: livello.numero, tentativi: MAX_TENTATIVI, ripiego: true },
  };
}

/** Il resto componibile piu' vicino a quello desiderato; lo zero c'e' sempre. */
function restoComponibilePiuVicino(calcolatore, desiderato) {
  const bersaglio = Math.max(0, Math.min(desiderato, calcolatore.centMax));
  for (let scarto = 0; scarto <= calcolatore.centMax; scarto++) {
    const giu = bersaglio - scarto;
    if (giu >= 0 && calcolatore.quantiPezzi(giu) >= 0) return giu;
    const su = bersaglio + scarto;
    if (su <= calcolatore.centMax && calcolatore.quantiPezzi(su) >= 0) return su;
  }
  return 0;
}

function provaTransazione(tipo, livello, cassetto, rng, obiettivo) {
  const conto = generaConto(livello, rng);
  const portafoglio = generaPortafoglio(conto, rng);

  if (tipo === 'conta') return provaConta(conto, portafoglio, cassetto, rng, obiettivo);

  const banconota = banconotaPerPagare(conto, portafoglio, rng);
  if (!banconota) return null;

  if (tipo === 'ricevi-spiccioli') {
    return provaRiceviSpiccioli(conto, portafoglio, banconota, cassetto, rng, obiettivo);
  }
  if (tipo === 'chiedi-spiccioli') {
    return provaChiediSpiccioli(conto, portafoglio, banconota, cassetto, rng, obiettivo);
  }

  // 'componi' e 'chiedi-spiccioli': banconota secca. Il mucchio da contare
  // appartiene a 'conta', dove il totale resta nascosto: mescolarli renderebbe
  // i due esercizi la stessa cosa.
  const ricevuto = sommaPezzi(banconota);
  if (ricevuto < conto) return null;
  if (!restoOttimale(ricevuto - conto, cassetto).possibile) return null;

  return componiTransazione({ tipo, conto, portafoglio, pezziPorti: banconota, ricevuto, cassetto, obiettivo });
}

/** Il cliente aggiunge di sua iniziativa le monete che rendono il resto piu' pulito. */
function provaRiceviSpiccioli(conto, portafoglio, banconota, cassetto, rng, obiettivo) {
  const base = sommaPezzi(banconota);
  if (base < conto) return null;
  const suggerimento = suggerisciSpiccioli(conto, base, portafoglio, cassetto, { obiettivo });
  if (!suggerimento.conviene) return null;

  // Ogni tanto il cliente sbaglia mira e aggiunge monete che non semplificano
  // niente: e' proprio il caso in cui non bisogna farsi confondere.
  const aggiunta = rng() < 0.25
    ? manciataDiMonete(portafoglio, rng, 2)
    : suggerimento.daChiedere;
  if (contaPezzi(aggiunta) === 0) return null;

  const pezziPorti = unisciPezzi(banconota, aggiunta);
  const ricevuto = sommaPezzi(pezziPorti);
  if (ricevuto < conto) return null;
  if (!restoOttimale(ricevuto - conto, cassetto).possibile) return null;

  return componiTransazione({
    tipo: 'ricevi-spiccioli',
    conto,
    portafoglio,
    pezziPorti,
    ricevuto,
    cassetto,
    obiettivo,
    spiccioliAggiunti: aggiunta,
  });
}

/**
 * Per allenare la decisione servono entrambi i casi: quello in cui chiedere
 * conviene e quello in cui e' meglio stare zitti. Senza i secondi si impara
 * solo a chiedere sempre.
 */
function provaChiediSpiccioli(conto, portafoglio, banconota, cassetto, rng, obiettivo) {
  const ricevuto = sommaPezzi(banconota);
  if (ricevuto < conto) return null;
  if (!restoOttimale(ricevuto - conto, cassetto).possibile) return null;

  const suggerimento = suggerisciSpiccioli(conto, ricevuto, portafoglio, cassetto, { obiettivo });
  const vogliamoCheConvenga = rng() < 0.7;
  if (suggerimento.conviene !== vogliamoCheConvenga) return null;

  return componiTransazione({
    tipo: 'chiedi-spiccioli',
    conto,
    portafoglio,
    pezziPorti: banconota,
    ricevuto,
    cassetto,
    obiettivo,
  });
}

/** Il mucchio di contanti posato sul bancone: a volte non copre nemmeno il conto. */
function provaConta(conto, portafoglio, cassetto, rng, obiettivo) {
  const insufficiente = rng() < 0.2;
  let pezziPorti;

  if (insufficiente) {
    // Anche il pagamento che non basta deve essere un mucchio: con un pezzo
    // solo lo scontrino mostrerebbe il totale e non ci sarebbe niente da contare.
    pezziPorti = manciataDiMonete(portafoglio, rng, 4);
    if (contaPezzi(pezziPorti) < 2 || sommaPezzi(pezziPorti) >= conto) return null;
  } else {
    const banconota = banconotaPerPagare(conto, portafoglio, rng);
    if (!banconota) return null;
    pezziPorti = unisciPezzi(banconota, manciataDiMonete(portafoglio, rng, 4));
    if (contaPezzi(pezziPorti) < 3) return null;
    if (!restoOttimale(sommaPezzi(pezziPorti) - conto, cassetto).possibile) return null;
  }

  return componiTransazione({
    tipo: 'conta',
    conto,
    portafoglio,
    pezziPorti,
    ricevuto: sommaPezzi(pezziPorti),
    cassetto,
    obiettivo,
  });
}

function componiTransazione({ tipo, conto, portafoglio, pezziPorti, ricevuto, cassetto, obiettivo = null, spiccioliAggiunti = null, ripiego = false }) {
  const bastano = ricevuto >= conto;
  const resto = bastano ? ricevuto - conto : 0;
  return {
    id: `${conto}-${ricevuto}-${tipo}-${Math.random().toString(36).slice(2, 8)}`,
    tipoEsercizio: tipo,
    conto,
    portafoglioCliente: portafoglio,
    pezziPorti,
    ricevuto,
    bastano,
    resto,
    mancano: bastano ? 0 : conto - ricevuto,
    spiccioliAggiunti,
    composizioneResto: restoOttimale(resto, cassetto).pezzi,
    // Il suggerimento costa una DP: lo calcoliamo solo dove il gioco lo usa.
    // Per il feedback degli altri esercizi si chiama suggerisciSpiccioli a mano.
    suggerimento: bastano && SERVE_SUGGERIMENTO.has(tipo)
      ? suggerisciSpiccioli(conto, ricevuto, portafoglio, cassetto, { obiettivo })
      : null,
    ripiego,
  };
}

/** Comodo per i test e per il debug: quali tagli servono davvero per questo resto. */
export function tagliCoinvolti(transazione) {
  return VALORI_RESTO.filter(v => (transazione.composizioneResto?.[v] ?? 0) > 0);
}
