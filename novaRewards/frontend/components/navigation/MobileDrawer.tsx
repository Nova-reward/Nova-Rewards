import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { X, Wallet, Star } from 'lucide-react';
import { useWalletStore } from '../../store/walletStore';
import { truncateAddress } from '../../lib/truncateAddress';
import type { NavItem } from './Navbar';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavItem[];
}

/**
 * Slide-out mobile navigation drawer.
 * Traps focus while open and supports keyboard dismissal (Escape).
 */
export default function MobileDrawer({ isOpen, onClose, items }: MobileDrawerProps) {
  const router = useRouter();
  const { publicKey, balance, connect, disconnect, isLoading } = useWalletStore();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button when drawer opens
  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus();
  }, [isOpen]);

  // Dismiss on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-brand-card md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-4 dark:border-brand-border">
          <Link
            href="/"
            onClick={onClose}
            aria-label="Nova Rewards home"
            className="flex items-center gap-2 text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 rounded-md"
          >
            <Star className="h-5 w-5 fill-current" aria-hidden="true" />
            <span className="font-bold text-base tracking-tight">NovaRewards</span>
          </Link>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Nav links */}
        <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-4">
          <ul role="list" className="space-y-1">
            {items.map(({ label, href }) => {
              const isActive = router.pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={onClose}
                    className={[
                      'flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
                      isActive
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                        : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
                    ].join(' ')}
                  >
                    {label}
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Wallet section */}
        <div className="border-t border-neutral-200 p-4 dark:border-brand-border">
          {publicKey ? (
            <div className="rounded-xl bg-neutral-50 p-3 dark:bg-brand-dark">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-primary-600" aria-hidden="true" />
                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                  Connected Wallet
                </span>
              </div>
              <p className="font-mono text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                {truncateAddress(publicKey)}
              </p>
              <p className="text-sm font-bold text-primary-600 dark:text-primary-400 mb-3">
                {parseFloat(balance).toLocaleString()} NOVA
              </p>
              <button
                onClick={() => { disconnect(); onClose(); }}
                className="w-full rounded-lg border border-error-500 py-2 text-sm font-medium text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => { connect(); }}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              {isLoading ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
