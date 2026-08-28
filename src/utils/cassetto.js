import { VALORI, VALORI_RESTO, etichettaTaglio } from '../data/valuta.js';
import { sommaPezzi, normalizzaPezzi } from './soldi.js';

/** Sotto questa quantita' un taglio e' "agli sgoccioli": va risparmiato. */
export const SOGLIA_SCARSITA = 3;

export function creaCassetto(fondo) {
  const cassetto = {};
  for (const valore of VALORI) cassetto[valore] = fondo?.[valore] ?? 0;
  return cassetto;
}

export function totaleCassetto(cassetto) {
  return sommaPezzi(cassetto);
}

/** Toglie i pezzi dal cassetto. Ritorna null se le scorte non bastano. */
export function preleva(cassetto, pezzi) {
  const nuovo = { ...cassetto };
  for (const [valore, quantita] of Object.entries(pezzi ?? {})) {
    const disponibile = nuovo[valore] ?? 0;
    if (quantita > disponibile) return null;
    nuovo[valore] = disponibile - quantita;
  }
  return nuovo;
}

/** Aggiunge i pezzi incassati dal cliente. */
export function deposita(cassetto, pezzi) {
  const nuovo = { ...cassetto };
  for (const [valore, quantita] of Object.entries(pezzi ?? {})) {
    nuovo[valore] = (nuovo[valore] ?? 0) + quantita;
  }
  return nuovo;
}

/** Una transazione completa: incassi quello che il cliente porge, rendi il resto. */
export function registraTransazione(cassetto, pezziRicevuti, pezziResi) {
  const dopoIncasso = deposita(cassetto, pezziRicevuti);
  const dopoResto = preleva(dopoIncasso, pezziResi);
  return dopoResto;
}

/** Tagli finiti o quasi: sono quelli che rendono utile chiedere spiccioli al cliente. */
export function tagliInEsaurimento(cassetto, soglia = SOGLIA_SCARSITA) {
  return VALORI_RESTO.filter(valore => (cassetto?.[valore] ?? 0) <= soglia);
}

export function tagliEsauriti(cassetto) {
  return VALORI_RESTO.filter(valore => (cassetto?.[valore] ?? 0) === 0);
}

/** true se quel taglio va risparmiato (ne restano pochi ma non zero). */
export function eScarso(cassetto, valore, soglia = SOGLIA_SCARSITA) {
  const quantita = cassetto?.[valore] ?? 0;
  return quantita > 0 && quantita <= soglia;
}

/**
 * Chiusura di cassa a fine turno: quanto e' entrato, se i conti tornano e
 * quali tagli sono finiti. La differenza e' l'errore accumulato dal giocatore.
 */
export function chiusuraCassa(iniziale, finale, incassoAtteso) {
  const totaleIniziale = totaleCassetto(iniziale);
  const totaleFinale = totaleCassetto(finale);
  const incassoEffettivo = totaleFinale - totaleIniziale;
  return {
    totaleIniziale,
    totaleFinale,
    incassoAtteso,
    incassoEffettivo,
    differenza: incassoEffettivo - incassoAtteso,
    quadra: incassoEffettivo === incassoAtteso,
    // Solo i tagli che c'erano all'apertura e sono finiti durante il turno:
    // quelli mai avuti in cassa non sono un fatto della giornata.
    esauriti: tagliEsauriti(finale)
      .filter(v => (iniziale?.[v] ?? 0) > 0)
      .map(v => ({ valore: v, etichetta: etichettaTaglio(v), partiti: iniziale[v] })),
    scarsi: tagliInEsaurimento(finale)
      .filter(v => (finale[v] ?? 0) > 0)
      .map(v => ({ valore: v, etichetta: etichettaTaglio(v), quantita: finale[v] })),
    residuo: normalizzaPezzi(finale),
  };
}
