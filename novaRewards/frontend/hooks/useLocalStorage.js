import { useState, useCallback } from 'react';

/**
 * useState backed by localStorage with JSON serialization.
 *
 * @template T
 * @param {string} key
 * @param {T} initialValue
 * @returns {[T, (value: T | ((prev: T) => T)) => void, () => void]}
 */
export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    setStored((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* quota exceeded */ }
      return next;
    });
  }, [key]);

  const remove = useCallback(() => {
    localStorage.removeItem(key);
    setStored(initialValue);
  }, [key, initialValue]);

  return [stored, setValue, remove];
}
