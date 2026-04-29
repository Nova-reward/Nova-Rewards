'use client';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import BottomNav from '../BottomNav';

/**
 * DashboardLayout — responsive layout wrapper for protected pages.
 * - Desktop (≥lg): sidebar + header + footer
 * - Mobile (<lg):  header + bottom tab bar; sidebar available as slide-out drawer
 */
export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-brand-dark transition-colors duration-200">
      {/* Sidebar — hidden on mobile, visible on lg+ */}
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <Header />

        {/* Main content — extra bottom padding on mobile to clear the bottom nav */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 pb-20 lg:pb-8 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
          {children}
        </main>

        {/* Footer — hidden on mobile to save space */}
        <div className="hidden lg:block">
          <Footer />
        </div>
      </div>

      {/* Bottom tab bar — mobile only */}
      <BottomNav />
    </div>
  );
}
