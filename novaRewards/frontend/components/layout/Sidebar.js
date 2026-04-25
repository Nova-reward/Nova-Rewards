'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  LayoutDashboard, 
  Megaphone, 
  Gift, 
  Wallet, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  X,
  CreditCard,
  Settings as SettingsIcon,
  HelpCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const NavLink = ({ item, collapsed, pathname, onClick }) => {
  const isActive = pathname === item.href;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 outline-none",
        isActive 
          ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20" 
          : "text-slate-500 hover:bg-gray-100 dark:hover:bg-brand-border dark:text-slate-400 dark:hover:text-slate-200"
      )}
      onClick={onClick}
    >
      <Icon className={cn("w-5 h-5 min-w-[20px] transition-transform duration-200", !isActive && "group-hover:scale-110")} />
      {!collapsed && <span className="font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200">{item.name}</span>}
      {!collapsed && isActive && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
      )}
    </Link>
  );
};

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { name: 'Merchant Portal', icon: Megaphone, href: '/merchant' },
  { name: 'Rewards', icon: Gift, href: '/rewards' },
  { name: 'Wallet', icon: Wallet, href: '/wallet' },
  { name: 'Transactions', icon: CreditCard, href: '/transactions' },
];

const secondaryNavItems = [
  { name: 'Settings', icon: SettingsIcon, href: '/settings' },
  { name: 'Help Support', icon: HelpCircle, href: '/help' },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  // Handle auto-collapse on smaller desktop screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsCollapsed(true);
      else setIsCollapsed(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  return (
    <>
      {/* Mobile Menu Button */}
      <button 
        onClick={() => setIsMobileMenuOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-violet-600 text-white rounded-full shadow-2xl lg:hidden active:scale-95 transition-transform"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside 
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-white border-r transition-all duration-300 ease-in-out dark:bg-brand-card dark:border-brand-border",
          "lg:sticky lg:top-0",
          isCollapsed ? "w-20" : "w-64",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b dark:border-brand-border">
          {!isCollapsed && (
            <span className="font-bold text-lg tracking-tight dark:text-white">Menu</span>
          )}
          {isCollapsed && <span className="mx-auto text-xl">⭐</span>}
          
          <button 
            onClick={() => isMobileMenuOpen ? setIsMobileMenuOpen(false) : setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-brand-border text-slate-500 lg:block"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex flex-col justify-between h-[calc(100%-64px)] p-4 overflow-y-auto overflow-x-hidden transition-all duration-300">
          <nav className="space-y-1.5">
            <div className={cn("px-2 mb-2 transition-opacity duration-200", isCollapsed ? "opacity-0 h-0" : "opacity-100")}>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Main Menu</span>
            </div>
            {navItems.map((item) => (
              <NavLink 
                key={item.name} 
                item={item} 
                collapsed={isCollapsed} 
                pathname={router.pathname}
                onClick={() => setIsMobileMenuOpen(false)}
              />
            ))}
          </nav>

          <nav className="space-y-1.5 mt-auto pt-6 border-t dark:border-brand-border/50">
            {secondaryNavItems.map((item) => (
              <NavLink 
                key={item.name} 
                item={item} 
                collapsed={isCollapsed} 
                pathname={router.pathname}
                onClick={() => setIsMobileMenuOpen(false)}
              />
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
