'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import AlertDialog   from '../components/modal/AlertDialog';
import ConfirmDialog from '../components/modal/ConfirmDialog';

/**
 * @typedef {{ type: 'alert'|'confirm', props: object, resolve: (v: any) => void }} ModalEntry
 */

const ModalContext = createContext(null);

/**
 * Provides programmatic modal access via `useModal()`.
 * Mount once in `_app.js` above all other providers.
 */
export function ModalProvider({ children }) {
  const [entry, setEntry] = useState(/** @type {ModalEntry|null} */ (null));

  const close = useCallback((value) => {
    entry?.resolve(value);
    setEntry(null);
  }, [entry]);

  /**
   * Show an alert dialog. Returns a Promise that resolves when dismissed.
   * @param {{ title: string, message: React.ReactNode, variant?: string, confirmText?: string }} opts
   */
  const alert = useCallback((opts) =>
    new Promise((resolve) => setEntry({ type: 'alert', props: opts, resolve })),
  []);

  /**
   * Show a confirm dialog. Returns a Promise<boolean> (true = confirmed).
   * @param {{ title: string, message: React.ReactNode, confirmText?: string, destructive?: boolean }} opts
   */
  const confirm = useCallback((opts) =>
    new Promise((resolve) => setEntry({ type: 'confirm', props: opts, resolve })),
  []);

  return (
    <ModalContext.Provider value={{ alert, confirm }}>
      {children}

      {entry?.type === 'alert' && (
        <AlertDialog
          isOpen
          onClose={() => close(undefined)}
          {...entry.props}
        />
      )}

      {entry?.type === 'confirm' && (
        <ConfirmDialog
          isOpen
          onClose={() => close(false)}
          onConfirm={() => close(true)}
          {...entry.props}
        />
      )}
    </ModalContext.Provider>
  );
}

/**
 * @returns {{ alert: (opts: object) => Promise<void>, confirm: (opts: object) => Promise<boolean> }}
 */
export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}
