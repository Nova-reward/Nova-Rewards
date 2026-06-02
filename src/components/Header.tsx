import React from 'react';
import Link from 'next/link';
import { BalanceDisplay } from './BalanceDisplay';
import { useAuth } from '@/hooks/useAuth';

export const Header: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-green-600 dark:text-green-400">
          Nova Rewards
        </Link>

        {/* Balance Display */}
        {isAuthenticated && user && (
          <div className="flex items-center gap-6">
            <BalanceDisplay className="text-right" />
          </div>
        )}

        {/* Auth Buttons */}
        <div className="flex items-center gap-4">
          {!isAuthenticated ? (
            <>
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400">
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Get Started
              </Link>
            </>
          ) : (
            <button
              onClick={() => {/* logout logic */}}
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
