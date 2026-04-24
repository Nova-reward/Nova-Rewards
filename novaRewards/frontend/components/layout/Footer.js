'use client';
import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white border-t py-8 px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-6 dark:bg-brand-card dark:border-brand-border transition-colors duration-200">
      <div className="flex flex-col items-center md:items-start gap-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⭐</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">NovaRewards</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          © {currentYear} NovaRewards. All rights reserved.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6">
        <Link href="/privacy" className="text-xs font-medium text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 transition-colors">
          Privacy Policy
        </Link>
        <Link href="/terms" className="text-xs font-medium text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 transition-colors">
          Terms of Service
        </Link>
        <Link href="/help" className="text-xs font-medium text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 transition-colors">
          Documentation
        </Link>
        <Link href="/contact" className="text-xs font-medium text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 transition-colors">
          Support
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse group-hover:bg-emerald-400 transition-colors"></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-300 transition-colors">System Operational</span>
        </div>
      </div>
    </footer>
  );
}
