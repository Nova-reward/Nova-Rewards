'use client';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

/**
 * DashboardLayout - A responsive layout wrapper for protected dashboard pages.
 * Includes Header, Sidebar, Main Content, and Footer.
 */
export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-brand-dark transition-colors duration-200">
      {/* Sidebar - Collapsible with desktop/mobile support */}
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 transition-all duration-300">
        {/* Header - Sticky with user profile and theme toggle */}
        <Header />

        {/* Main Content Area - Scrollable with proper padding */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 md:px-8 py-8 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
          {children}
        </main>

        {/* Footer - Minimal and responsive */}
        <Footer />
      </div>
    </div>
  );
}
