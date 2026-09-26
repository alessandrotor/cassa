import { useState, useCallback } from 'react';

/**
 * @param {Function} [normalizza] ripulisce il valore letto: i salvataggi di
 *   versioni vecchie possono non avere i campi aggiunti dopo.
 */
export default function useLocalStorage(key, initialValue, normalizza = v => v) {
  const [value, setValueState] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? normalizza(JSON.parse(item)) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((updater) => {
    setValueState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, [key]);

  return [value, setValue];
}
