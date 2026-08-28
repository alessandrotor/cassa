import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Cronometro del round. Misura sempre il tempo impiegato; se `secondi` è > 0
 * fa anche il conto alla rovescia e chiama `alloScadere`.
 *
 * Il tempo si legge da `performance.now()` e non contando i tick: se il
 * telefono si addormenta o l'utente cambia scheda, il conteggio degli
 * intervalli va alla deriva, il timestamp no.
 */
export default function useTimer(secondi, attivo, alloScadere) {
  const [msTrascorsi, setMsTrascorsi] = useState(0);
  const inizio = useRef(0);
  const scaduto = useRef(false);
  const callback = useRef(alloScadere);
  callback.current = alloScadere;

  useEffect(() => {
    if (!attivo) return undefined;

    inizio.current = performance.now();
    scaduto.current = false;
    setMsTrascorsi(0);

    const id = setInterval(() => {
      const trascorsi = performance.now() - inizio.current;
      setMsTrascorsi(trascorsi);
      if (secondi > 0 && trascorsi >= secondi * 1000 && !scaduto.current) {
        scaduto.current = true;
        callback.current?.(trascorsi);
      }
    }, 100);

    return () => clearInterval(id);
  }, [attivo, secondi]);

  const leggi = useCallback(
    () => (attivo ? performance.now() - inizio.current : msTrascorsi),
    [attivo, msTrascorsi],
  );

  const msRimasti = secondi > 0 ? Math.max(0, secondi * 1000 - msTrascorsi) : 0;

  return { msTrascorsi, msRimasti, frazioneRimasta: secondi > 0 ? msRimasti / (secondi * 1000) : 1, leggi };
}
