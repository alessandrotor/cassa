import { contaPezzi } from './soldi.js';

/**
 * La forma della risposta del giocatore, e quando è confermabile.
 *
 * Sta qui e non dentro il componente perché è regola di gioco, non
 * presentazione: se una situazione non ha nessuna risposta confermabile il
 * giocatore resta bloccato fino allo scadere del timer, ed è successo davvero
 * col pagamento esatto. Tenerla in un modulo puro la rende verificabile.
 *
 * `dichiarazione` copre i due casi in cui non si rende niente, ed è un campo
 * solo perché si escludono a vicenda: o il cliente ha pagato giusto
 * (`'senza-resto'`), o non ha dato abbastanza (`'non-basta'`).
 */
export function rispostaIniziale(tipoEsercizio) {
  if (tipoEsercizio === 'chiedi-spiccioli') return { chiesti: {} };
  return { pezzi: {}, dichiarazione: null };
}

/** Si può confermare solo quando c'è davvero qualcosa da confermare. */
export function rispostaPronta(tipoEsercizio, risposta) {
  if (tipoEsercizio === 'chiedi-spiccioli') return true; // "non chiedo niente" è una risposta
  return contaPezzi(risposta?.pezzi) > 0 || risposta?.dichiarazione != null;
}
