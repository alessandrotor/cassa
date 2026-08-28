// Tutti gli importi dell'app sono interi in CENTESIMI. Mai float: 0.1 + 0.2
// non fa 0.3, e in un gioco che valuta il resto un centesimo di deriva
// significa insegnare la cosa sbagliata.

export const TAGLI = [
  { valore: 5000, tipo: 'banconota', etichetta: '50 €' },
  { valore: 2000, tipo: 'banconota', etichetta: '20 €' },
  { valore: 1000, tipo: 'banconota', etichetta: '10 €' },
  { valore: 500, tipo: 'banconota', etichetta: '5 €' },
  { valore: 200, tipo: 'moneta', etichetta: '2 €' },
  { valore: 100, tipo: 'moneta', etichetta: '1 €' },
  { valore: 50, tipo: 'moneta', etichetta: '50 c' },
  { valore: 20, tipo: 'moneta', etichetta: '20 c' },
  { valore: 10, tipo: 'moneta', etichetta: '10 c' },
  { valore: 5, tipo: 'moneta', etichetta: '5 c' },
  { valore: 2, tipo: 'moneta', etichetta: '2 c' },
  { valore: 1, tipo: 'moneta', etichetta: '1 c' },
];

/** Valori dal piu' grande al piu' piccolo: l'ordine su cui girano tutti gli algoritmi. */
export const VALORI = TAGLI.map(t => t.valore);

/** Solo i tagli che un cassiere rende davvero come resto (le banconote grosse restano in cassaforte). */
export const VALORI_RESTO = VALORI.filter(v => v <= 5000);

/** Tagli che un cliente puo' avere in tasca per arrotondare il pagamento. */
export const VALORI_SPICCIOLI = [200, 100, 50, 20, 10, 5, 2, 1];

const perValore = new Map(TAGLI.map(t => [t.valore, t]));

export function taglio(valore) {
  return perValore.get(valore);
}

export function etichettaTaglio(valore) {
  return perValore.get(valore)?.etichetta ?? `${valore} c`;
}

export function eBanconota(valore) {
  return perValore.get(valore)?.tipo === 'banconota';
}

/**
 * Fondo cassa realistico all'apertura del turno: circa 250 €, con poche
 * monete piccole. E' proprio la scarsita' dei tagli minuti a rendere
 * interessante la modalita' Turno.
 */
export const FONDO_CASSA_INIZIALE = Object.freeze({
  5000: 1,
  2000: 3,
  1000: 5,
  500: 6,
  200: 10,
  100: 12,
  50: 10,
  20: 10,
  10: 8,
  5: 6,
  2: 5,
  1: 5,
});
