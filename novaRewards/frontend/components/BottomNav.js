'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';

/**
 * Mobile bottom navigation bar — visible only on screens below lg breakpoint.
 * Touch targets meet the 44×44px minimum (WCAG 2.5.5).
 */
const NAV_ITEMS = [
  { href: '/dashboard',   icon: '📊', label: 'Home' },
  { href: '/campaigns',   icon: '🎯', label: 'Campaigns' },
  { href: '/rewards',     icon: '🎁', label: 'Rewards' },
  { href: '/leaderboard', icon: '🏆', label: 'Ranks' },
  { href: '/settings',    icon: '⚙️',  label: 'Settings' },
];

export default function BottomNav() {
  const { pathname } = useRouter();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t bg-white dark:bg-brand-card dark:border-brand-border lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Mobile navigation"
    >
      {NAV_ITEMS.map(({ href, icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={[
              // Touch target: flex-1 ensures full-width tap area, min-h satisfies 44px
              'touch-target flex flex-1 flex-col items-center justify-center gap-0.5',
              'text-xs font-medium transition-colors duration-150',
              '-webkit-tap-highlight-color-transparent',
              active
                ? 'text-brand-purple'
                : 'text-slate-500 dark:text-slate-400 hover:text-brand-purple',
            ].join(' ')}
          >
            <span className="text-xl leading-none" aria-hidden="true">{icon}</span>
            <span className="leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
