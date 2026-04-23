'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';

/**
 * Mobile bottom navigation bar — visible only on small screens.
 * Mirrors the sidebar nav links with touch-friendly tap targets.
 */
const NAV_ITEMS = [
  { href: '/dashboard',   icon: '📊', label: 'Home' },
  { href: '/rewards',     icon: '🎁', label: 'Rewards' },
  { href: '/leaderboard', icon: '🏆', label: 'Ranks' },
  { href: '/history',     icon: '📜', label: 'History' },
  { href: '/settings',    icon: '⚙️',  label: 'Settings' },
];

export default function BottomNav() {
  const { pathname } = useRouter();

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {NAV_ITEMS.map(({ href, icon, label }) => (
        <Link
          key={href}
          href={href}
          className={`bottom-nav-item${pathname === href ? ' bottom-nav-item--active' : ''}`}
          aria-current={pathname === href ? 'page' : undefined}
        >
          <span className="bottom-nav-icon" aria-hidden="true">{icon}</span>
          <span className="bottom-nav-label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
