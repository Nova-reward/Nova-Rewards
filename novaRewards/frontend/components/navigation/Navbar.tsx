import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu, Wallet, Star } from 'lucide-react';
import { useWalletStore } from '../../store/walletStore';
import { truncateAddress } from '../../lib/truncateAddress';
import { useNavigation } from '../../hooks/useNavigation';

export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',  href: '/dashboard' },
  { label: 'Rewards',    href: '/rewards' },
  { label: 'Merchant',   href: '/merchant' },
  { label: 'History',    href: '/history' },
  { label: 'Leaderboard', href: '/leaderboard' },
];

interface NavbarProps {
  /** Override nav items (useful for Storybook / testing) */
  items?: NavItem[];
}

export default function Navbar({ items = NAV_ITEMS }: NavbarProps) {
  const router   = useRouter();
  const { publicKey, balance, connect, disconnect, isLoading } = useWalletStore();
  const { toggleDrawer } = useNavigation();

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/90 backdrop-blur-sm dark:border-brand-border dark:bg-brand-card/90"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">

        {/* Logo */}
        <Link
          href="/"
          aria-label="Nova Rewards home"
          className="flex items-center gap-2 text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 rounded-md"
        >
          <Star className="h-6 w-6 fill-current" aria-hidden="true" />
          <span className="font-bold text-lg tracking-tight">NovaRewards</span>
        </Link>

        {/* Desktop nav links */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
          {items.map(({ label, href }) => {
            const isActive = router.pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                    : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
                ].join(' ')}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Wallet + hamburger */}
        <div className="flex items-center gap-2">
          {/* Wallet info / connect button */}
          {publicKey ? (
            <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-brand-border dark:bg-brand-dark">
              <Wallet className="h-4 w-4 text-primary-600" aria-hidden="true" />
              <div className="hidden sm:flex flex-col leading-none">
                <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                  {truncateAddress(publicKey)}
                </span>
                <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                  {parseFloat(balance).toLocaleString()} NOVA
                </span>
              </div>
              <button
                onClick={disconnect}
                aria-label="Disconnect wallet"
                className="ml-1 hidden sm:block text-xs text-neutral-400 hover:text-error-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 rounded"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => connect()}
              disabled={isLoading}
              aria-label="Connect wallet"
              className="hidden sm:flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              {isLoading ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}

          {/* Hamburger — mobile only */}
          <button
            onClick={toggleDrawer}
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
