import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';

export interface UseNavigationReturn {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

/**
 * Manages mobile drawer open/close state.
 * Automatically closes on route change and locks body scroll while open.
 */
export function useNavigation(): UseNavigationReturn {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const router = useRouter();

  const openDrawer  = useCallback(() => setIsDrawerOpen(true),  []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setIsDrawerOpen(prev => !prev), []);

  // Close drawer on route change
  useEffect(() => {
    router.events.on('routeChangeStart', closeDrawer);
    return () => router.events.off('routeChangeStart', closeDrawer);
  }, [router.events, closeDrawer]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isDrawerOpen]);

  return { isDrawerOpen, openDrawer, closeDrawer, toggleDrawer };
}
