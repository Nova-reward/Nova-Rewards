import Link from 'next/link';
import { useRouter } from 'next/router';

// Internal nav items only — external links never receive active state
const NAV_ITEMS = [
  { label: 'Customer Portal', href: '/', matchPaths: ['/', '/dashboard'] },
  { label: 'Merchant Portal', href: '/merchant' },
];

export default function Navbar({ children }) {
  const { pathname } = useRouter();

  function isActive({ href, matchPaths }) {
    if (matchPaths) return matchPaths.includes(pathname);
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <nav className="nav">
      <span className="nav-brand">⭐ NovaRewards</span>
      <div className="nav-links">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item) ? 'nav-active' : undefined}
          >
            {item.label}
          </Link>
        ))}
        {children}
      </div>
    </nav>
  );
}
