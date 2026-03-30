import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

const SCROLL_KEY = 'scrollPos';

/**
 * Saves and restores window scroll position for a given route key.
 * Call this once inside the page component that needs scroll restoration.
 *
 * @param {string} key  Unique key for this page (e.g. 'rewards')
 */
export function useScrollRestoration(key) {
  const router = useRouter();
  const storageKey = `${SCROLL_KEY}:${key}`;
  const restored = useRef(false);

  // Restore on mount
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) window.scrollTo(0, parseInt(saved, 10));
    } catch {}
  }, [storageKey]);

  // Save before navigating away
  useEffect(() => {
    const save = () => {
      try { sessionStorage.setItem(storageKey, String(window.scrollY)); } catch {}
    };
    router.events.on('routeChangeStart', save);
    return () => router.events.off('routeChangeStart', save);
  }, [router.events, storageKey]);
}
