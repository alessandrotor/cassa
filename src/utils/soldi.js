import { VALORI, etichettaTaglio, eMoneta } from '../data/valuta.js';

/** 760 -> "7,60 €" */
export function formatEuro(cent, { simbolo = true } = {}) {
  const negativo = cent < 0;
  const assoluto = Math.abs(Math.round(cent));
  const euro = Math.floor(assoluto / 100);
  const decimali = String(assoluto % 100).padStart(2, '0');
  const corpo = `${negativo ? '-' : ''}${euro},${decimali}`;
  return simbolo ? `${corpo} €` : corpo;
}

/** "7,60" | "7.6" | "760" (se giaCentesimi) -> centesimi interi, oppure null se non interpretabile. */
export function parseEuro(testo) {
  if (typeof testo === 'number') return Math.round(testo * 100);
  const pulito = String(testo).trim().replace(/[€\s]/g, '').replace(',', '.');
  if (pulito === '' || !/^-?\d*\.?\d*$/.test(pulito)) return null;
  const numero = Number(pulito);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100);
}

/** Mappa { valoreTaglio: quantita } -> totale in centesimi. */
export function sommaPezzi(pezzi) {
  let totale = 0;
  for (const [valore, quantita] of Object.entries(pezzi ?? {})) {
    totale += Number(valore) * quantita;
  }
  return totale;
}

/** Mappa { valoreTaglio: quantita } -> numero di banconote/monete. */
export function contaPezzi(pezzi) {
  let totale = 0;
  for (const quantita of Object.values(pezzi ?? {})) totale += quantita;
  return totale;
}

/** Quante di quelle sono monete: e' la misura che conta per chi prende il turno dopo. */
export function contaMonete(pezzi) {
  let totale = 0;
  for (const [valore, quantita] of Object.entries(pezzi ?? {})) {
    if (eMoneta(Number(valore))) totale += quantita;
  }
  return totale;
}

/** Somma due mappe di pezzi in una nuova mappa. */
export function unisciPezzi(a, b) {
  const risultato = { ...(a ?? {}) };
  for (const [valore, quantita] of Object.entries(b ?? {})) {
    risultato[valore] = (risultato[valore] ?? 0) + quantita;
  }
  return normalizzaPezzi(risultato);
}

/** Toglie le voci a zero. Per l'ordine di visualizzazione usa elencaPezzi. */
export function normalizzaPezzi(pezzi) {
  const risultato = {};
  for (const valore of VALORI) {
    const quantita = pezzi?.[valore] ?? 0;
    if (quantita > 0) risultato[valore] = quantita;
  }
  return risultato;
}

/** Mappa di pezzi -> [{ valore, quantita, etichetta }] ordinata, comoda per il rendering. */
export function elencaPezzi(pezzi) {
  return VALORI
    .filter(valore => (pezzi?.[valore] ?? 0) > 0)
    .map(valore => ({ valore, quantita: pezzi[valore], etichetta: etichettaTaglio(valore) }));
}

/**
 * L'importo come lo direbbe una persona: «5 centesimi», «un euro», «2 euro e 10».
 * Serve alle battute del cliente e alla domanda del cassiere, dove elencare i
 * tagli uno per uno suonerebbe come un tabulato invece che come una frase.
 */
export function importoParlato(cent) {
  const assoluto = Math.abs(Math.round(cent));
  const euro = Math.floor(assoluto / 100);
  const centesimi = assoluto % 100;
  if (euro === 0) return centesimi === 1 ? 'un centesimo' : `${centesimi} centesimi`;
  const parteEuro = euro === 1 ? 'un euro' : `${euro} euro`;
  return centesimi === 0 ? parteEuro : `${parteEuro} e ${centesimi}`;
}

/** "1× 5 €, 2× 1 €" — la forma compatta per il feedback didattico. */
export function descriviPezzi(pezzi) {
  const voci = elencaPezzi(pezzi);
  if (voci.length === 0) return 'niente';
  return voci.map(v => `${v.quantita}× ${v.etichetta}`).join(' + ');
}
