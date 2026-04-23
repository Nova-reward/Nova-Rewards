import { ReactNode } from 'react';
import Navbar, { NAV_ITEMS } from '../navigation/Navbar';
import MobileDrawer from '../navigation/MobileDrawer';
import { useNavigation } from '../../hooks/useNavigation';

interface LayoutProps {
  children: ReactNode;
  /** Remove max-width constraint for full-bleed pages */
  fullWidth?: boolean;
}

/**
 * Root layout for authenticated pages.
 * Composes Navbar + MobileDrawer and provides consistent page padding.
 */
export default function Layout({ children, fullWidth = false }: LayoutProps) {
  const { isDrawerOpen, openDrawer, closeDrawer, toggleDrawer } = useNavigation();

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-brand-dark transition-colors duration-200">
      <Navbar items={NAV_ITEMS} />

      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        items={NAV_ITEMS}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className={[
          'flex-1 w-full mx-auto px-4 py-8 md:px-8',
          fullWidth ? '' : 'max-w-7xl',
        ].join(' ')}
      >
        {children}
      </main>

      <footer className="border-t border-neutral-200 dark:border-brand-border py-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
        © {new Date().getFullYear()} Nova Rewards. All rights reserved.
      </footer>
    </div>
  );
}
