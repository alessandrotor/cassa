import { VALORI_RESTO } from '../data/valuta.js';
import { sommaPezzi, contaPezzi, normalizzaPezzi } from './soldi.js';

const INF = Number.POSITIVE_INFINITY;
/** Oltre questa soglia non ha senso comporre un resto: è un errore d'uso, non un caso di gioco. */
const MASSIMO_COMPONIBILE = 100000;

/**
 * Tabella di programmazione dinamica per il resto: tab[p][i] è il minimo numero
 * di pezzi per fare i centesimi usando solo i primi p tagli.
 *
 * L'euro è un sistema canonico, quindi con cassetto illimitato basterebbe il
 * greedy. Ma nella modalità Turno il cassetto si esaurisce, e lì il greedy
 * fallisce — o peggio, mente, dichiarando impossibile un resto che esiste.
 *
 * Costruire la tabella una volta sola e interrogarla per più importi è quello
 * che rende praticabile `suggerisciSpiccioli`, che deve valutare decine di
 * alternative sullo stesso cassetto.
 *
 * @param {number} centMax importo massimo interrogabile
 * @param {Object|null} disponibilita mappa { valore: quantita }; null = illimitato
 */
export function creaTabellaResti(centMax, disponibilita = null) {
  const limite = Math.max(0, Math.min(Math.floor(centMax), MASSIMO_COMPONIBILE));
  const tagli = VALORI_RESTO;
  const scorte = tagli.map(v => (disponibilita ? (disponibilita[v] ?? 0) : Infinity));

  const iniziale = new Array(limite + 1).fill(INF);
  iniziale[0] = 0;
  const tab = [iniziale];

  for (let p = 0; p < tagli.length; p++) {
    const valore = tagli[p];
    const scorta = scorte[p];
    const precedente = tab[p];
    const corrente = precedente.slice();

    if (scorta === Infinity) {
      for (let i = valore; i <= limite; i++) {
        if (corrente[i - valore] + 1 < corrente[i]) corrente[i] = corrente[i - valore] + 1;
      }
    } else if (scorta > 0) {
      for (let i = valore; i <= limite; i++) {
        const kMax = Math.min(scorta, Math.floor(i / valore));
        for (let k = 1; k <= kMax; k++) {
          const base = precedente[i - k * valore];
          if (base + k < corrente[i]) corrente[i] = base + k;
        }
      }
    }
    tab.push(corrente);
  }

  const finale = tab[tagli.length];

  const dentro = cent => Number.isInteger(cent) && cent >= 0 && cent <= limite;

  return {
    centMax: limite,
    possibile: cent => dentro(cent) && finale[cent] !== INF,
    totalePezzi: cent => (dentro(cent) ? finale[cent] : INF),
    /** Ricostruzione a ritroso: a ogni livello si deduce quante volte è stato usato quel taglio. */
    pezzi(cent) {
      if (!dentro(cent) || finale[cent] === INF) return {};
      const pezzi = {};
      let residuo = cent;
      for (let p = tagli.length; p > 0; p--) {
        const valore = tagli[p - 1];
        const kMax = Math.min(scorte[p - 1], Math.floor(residuo / valore));
        for (let k = 0; k <= kMax; k++) {
          if (tab[p - 1][residuo - k * valore] + k === tab[p][residuo]) {
            if (k > 0) pezzi[valore] = k;
            residuo -= k * valore;
            break;
          }
        }
      }
      return normalizzaPezzi(pezzi);
    },
  };
}

/**
 * Il greedy: prende sempre il taglio più grande che ci sta. Ritorna null se le
 * scorte non bastano ad arrivare esattamente all'importo.
 *
 * Sull'euro il greedy è ottimo (il sistema 1-2-5 è canonico), e questo vale
 * anche a scorte limitate: se il greedy arriva in fondo senza sforare le
 * quantità, il numero di pezzi che usa è già il minimo assoluto, quindi a
 * maggior ragione è il minimo fra le soluzioni che il cassetto permette.
 * Quando invece si arena, serve davvero la DP. Il test `resto.test.js`
 * confronta le due strade su ogni importo, ed è quello che tiene onesta
 * questa scorciatoia.
 */
function greedy(cent, disponibilita) {
  const pezzi = {};
  let resto = cent;
  for (const valore of VALORI_RESTO) {
    if (resto < valore) continue;
    const disponibili = disponibilita ? (disponibilita[valore] ?? 0) : Infinity;
    const quante = Math.min(Math.floor(resto / valore), disponibili);
    if (quante > 0) {
      pezzi[valore] = quante;
      resto -= quante * valore;
    }
    if (resto === 0) break;
  }
  return resto === 0 ? pezzi : null;
}

/** Come greedy, ma conta e basta: nessun oggetto allocato per chi vuole solo il numero. */
function contaGreedy(cent, disponibilita) {
  let resto = cent;
  let pezzi = 0;
  for (const valore of VALORI_RESTO) {
    if (resto < valore) continue;
    const disponibili = disponibilita ? (disponibilita[valore] ?? 0) : Infinity;
    const quante = Math.min(Math.floor(resto / valore), disponibili);
    pezzi += quante;
    resto -= quante * valore;
    if (resto === 0) break;
  }
  return resto === 0 ? pezzi : -1;
}

function conta(pezzi) {
  let totale = 0;
  for (const valore in pezzi) totale += pezzi[valore];
  return totale;
}

const VUOTO = Object.freeze({ pezzi: {}, totalePezzi: 0, possibile: false });

function fuoriPortata(cent) {
  return !Number.isInteger(cent) || cent < 0 || cent > MASSIMO_COMPONIBILE;
}

/**
 * Composizione del resto con il minimo numero di pezzi, rispettando le scorte.
 *
 * @param {number} cent importo da comporre, in centesimi
 * @param {Object|null} disponibilita mappa { valore: quantita }; null = illimitato
 * @returns {{ pezzi: Object, totalePezzi: number, possibile: boolean }}
 */
export function restoOttimale(cent, disponibilita = null) {
  if (fuoriPortata(cent)) return VUOTO;
  if (cent === 0) return { pezzi: {}, totalePezzi: 0, possibile: true };

  const veloce = greedy(cent, disponibilita);
  if (veloce) return { pezzi: veloce, totalePezzi: conta(veloce), possibile: true };
  // Senza vincoli il greedy non fallisce mai: se siamo qui, il cassetto c'è.
  if (!disponibilita) return VUOTO;

  return leggiTabella(creaTabellaResti(cent, disponibilita), cent);
}

/**
 * Un interrogatore del resto da riusare su più importi con lo stesso cassetto.
 * Prova il greedy a ogni domanda e costruisce la tabella DP solo la prima volta
 * che il greedy si arena — con un cassetto ben fornito non la costruisce mai.
 */
export function creaCalcolatoreResto(centMax, disponibilita = null) {
  let tabella = null;
  const dp = () => (tabella ??= creaTabellaResti(centMax, disponibilita));

  return {
    centMax,
    /** Solo il numero di pezzi: -1 se l'importo non è componibile. */
    quantiPezzi(cent) {
      if (fuoriPortata(cent) || cent > centMax) return -1;
      const veloce = contaGreedy(cent, disponibilita);
      if (veloce >= 0) return veloce;
      if (!disponibilita) return -1;
      return dp().possibile(cent) ? dp().totalePezzi(cent) : -1;
    },
    /** Il risultato completo, nella forma di restoOttimale. */
    valuta(cent) {
      if (fuoriPortata(cent) || cent > centMax) return VUOTO;
      if (cent === 0) return { pezzi: {}, totalePezzi: 0, possibile: true };
      const veloce = greedy(cent, disponibilita);
      if (veloce) return { pezzi: veloce, totalePezzi: conta(veloce), possibile: true };
      if (!disponibilita) return VUOTO;
      return leggiTabella(dp(), cent);
    },
  };
}

/** Estrae da una tabella già costruita il risultato nella forma di restoOttimale. */
export function leggiTabella(tabella, cent) {
  if (!tabella.possibile(cent)) return VUOTO;
  return { pezzi: tabella.pezzi(cent), totalePezzi: tabella.totalePezzi(cent), possibile: true };
}

/**
 * Giudica la composizione proposta dal giocatore.
 * La regola scelta: conta che la cifra sia esatta; il numero minimo di pezzi
 * è un bonus, non un requisito.
 */
export function verificaComposizione(pezziProposti, restoAtteso, disponibilita = null) {
  const totale = sommaPezzi(pezziProposti);
  const ottimale = restoOttimale(restoAtteso, disponibilita);
  const pezziUsati = contaPezzi(pezziProposti);
  const esatta = totale === restoAtteso;
  return {
    esatta,
    totale,
    differenza: totale - restoAtteso,
    pezziUsati,
    minima: esatta && ottimale.possibile && pezziUsati === ottimale.totalePezzi,
    pezziOttimali: ottimale.pezzi,
    totalePezziOttimali: ottimale.totalePezzi,
    ottimalePossibile: ottimale.possibile,
    eccedeScorte: eccedeDisponibilita(pezziProposti, disponibilita),
  };
}

/** true se il giocatore ha usato più pezzi di quanti ce ne siano in cassetto. */
export function eccedeDisponibilita(pezzi, disponibilita) {
  if (!disponibilita) return false;
  for (const [valore, quantita] of Object.entries(pezzi ?? {})) {
    if (quantita > (disponibilita[valore] ?? 0)) return true;
  }
  return false;
}

/**
 * Il conteggio progressivo ("counting up"), il metodo che si insegna davvero
 * in cassa: si parte dal conto e si sale fino al ricevuto aggiungendo i pezzi
 * dal più piccolo al più grande.
 *
 * Conto 12,40 € pagato con 20 € →
 *   +0,10 → 12,50 | +0,50 → 13,00 | +2 € → 15,00 | +5 € → 20,00
 *
 * @returns {Array<{ valore: number, cumulato: number }>}
 */
export function conteggioProgressivo(conto, ricevuto, pezzi = null) {
  const composizione = pezzi ?? restoOttimale(ricevuto - conto).pezzi;
  const passi = [];
  let cumulato = conto;
  // Dal taglio più piccolo al più grande: è l'ordine in cui si posano i soldi
  // sul bancone contando ad alta voce.
  const valoriCrescenti = [...VALORI_RESTO].sort((a, b) => a - b);
  for (const valore of valoriCrescenti) {
    for (let i = 0; i < (composizione[valore] ?? 0); i++) {
      cumulato += valore;
      passi.push({ valore, cumulato });
    }
  }
  return passi;
}
