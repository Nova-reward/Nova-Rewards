'use client';
import { useState, useRef, useEffect } from 'react';
import { useWalletStore } from '../../store/walletStore';
import ThemeToggle from './ThemeToggle';
import { User, Settings, LogOut, ChevronDown, Bell } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  const { publicKey, disconnect } = useWalletStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const shortKey = publicKey ? `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}` : 'Not Connected';

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-white px-4 md:px-8 dark:bg-brand-card dark:border-brand-border">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">⭐</span>
          <span className="hidden font-bold text-xl text-violet-600 md:block">NovaRewards</span>
        </Link>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <button className="p-2 text-slate-500 hover:bg-gray-100 dark:hover:bg-brand-border rounded-lg transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-brand-card"></span>
        </button>
        
        <ThemeToggle />

        <div className="h-8 w-px bg-gray-200 dark:bg-brand-border mx-1 hidden md:block"></div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-brand-border transition-colors outline-none border border-transparent focus:border-violet-600/30"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden md:flex flex-col items-start leading-none gap-1 mr-1">
              <span className="text-sm font-medium dark:text-slate-200">My Wallet</span>
              <span className="text-xs text-slate-500 font-mono tracking-tight">{shortKey}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border bg-white shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-brand-card dark:border-brand-border overflow-hidden animate-in fade-in zoom-in duration-150">
              <div className="py-2">
                <Link
                  href="/profile"
                  className="flex items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-brand-border gap-3 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <User className="w-4 h-4 text-violet-600" />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-brand-border gap-3 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  Settings
                </Link>
                <div className="my-1 border-t dark:border-brand-border"></div>
                <button
                  onClick={() => {
                    disconnect();
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 gap-3 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
