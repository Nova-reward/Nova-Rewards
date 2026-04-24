import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu, Star } from 'lucide-react';
import WalletConnectButton from '../WalletConnectButton';
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
          {/* Wallet connect button — handles all states */}
          <div className="hidden sm:block">
            <WalletConnectButton />
          </div>

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
