/**
 * Il punteggio premia, non punisce: sbagliare azzera la serie ma non toglie
 * punti. È un allenamento, e chi si allena deve avere voglia di riprovare.
 */

export const PUNTI_CORRETTA = 100;
export const PUNTI_VELOCITA_MAX = 50;
export const PUNTI_COMPOSIZIONE_MINIMA = 30;
/** Oltre la decima di fila il moltiplicatore si ferma: non serve premiare all'infinito. */
export const STREAK_MASSIMA_UTILE = 10;

export function moltiplicatoreStreak(streak) {
  return 1 + Math.min(streak, STREAK_MASSIMA_UTILE) * 0.1;
}

/**
 * @param {{ corretta: boolean, minima?: boolean, etichettaBonus?: string,
 *            msImpiegati?: number, secondiTimer?: number, streak?: number }} esito
 * @returns {{ punti: number, dettaglio: Array<{ voce: string, punti: number }> }}
 */
export function calcolaPunti({
  corretta,
  minima = false,
  etichettaBonus = 'Meno pezzi possibile',
  msImpiegati = 0,
  secondiTimer = 0,
  streak = 0,
}) {
  if (!corretta) return { punti: 0, dettaglio: [] };

  const dettaglio = [{ voce: 'Risposta giusta', punti: PUNTI_CORRETTA }];
  let punti = PUNTI_CORRETTA;

  if (secondiTimer > 0) {
    const frazioneRimasta = Math.max(0, 1 - msImpiegati / (secondiTimer * 1000));
    const bonus = Math.round(PUNTI_VELOCITA_MAX * frazioneRimasta);
    if (bonus > 0) {
      punti += bonus;
      dettaglio.push({ voce: 'Velocità', punti: bonus });
    }
  }

  if (minima) {
    punti += PUNTI_COMPOSIZIONE_MINIMA;
    dettaglio.push({ voce: etichettaBonus, punti: PUNTI_COMPOSIZIONE_MINIMA });
  }

  const moltiplicatore = moltiplicatoreStreak(streak);
  if (moltiplicatore > 1) {
    const prima = punti;
    punti = Math.round(punti * moltiplicatore);
    dettaglio.push({ voce: `Serie ×${moltiplicatore.toFixed(1)}`, punti: punti - prima });
  }

  return { punti, dettaglio };
}
