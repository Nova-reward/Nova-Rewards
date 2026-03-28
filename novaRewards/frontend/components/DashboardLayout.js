'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

/**
 * Dashboard layout with collapsible sidebar and header
 * Requirements: 164.1, 164.2, 164.3, 164.4, 164.5
 */
export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { user, logout, isAuthenticated, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  }, [router.pathname]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuOpen && !event.target.closest('.profile-menu-container')) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [profileMenuOpen]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleProfileMenu = () => {
    setProfileMenuOpen(!profileMenuOpen);
  };

  // Navigation links
  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { href: '/rewards', label: 'Rewards', icon: '🎁' },
    { href: '/history', label: 'History', icon: '📜' },
    { href: '/referral', label: 'Referral', icon: '👥' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  // Get page title from current route
  const getPageTitle = () => {
    const currentLink = navLinks.find(link => link.href === router.pathname);
    return currentLink ? currentLink.label : 'Dashboard';
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <Link href="/dashboard" className="sidebar-logo">
            <span className="logo-icon">⭐</span>
            {sidebarOpen && <span className="logo-text">NovaRewards</span>}
          </Link>
          <button
            className="sidebar-toggle desktop-only"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${router.pathname === link.href ? 'nav-link-active' : ''}`}
            >
              <span className="nav-icon">{link.icon}</span>
              {sidebarOpen && <span className="nav-label">{link.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="btn btn-secondary btn-full"
            onClick={handleLogout}
          >
            <span className="nav-icon">🚪</span>
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className={`main-wrapper ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <button
              className="mobile-menu-btn mobile-only"
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
            >
              ☰
            </button>
            <h1 className="page-title">{getPageTitle()}</h1>
          </div>

          <div className="header-right">
            {/* Notification bell */}
            <button className="header-icon-btn" aria-label="Notifications">
              <span className="notification-icon">🔔</span>
              <span className="notification-badge">3</span>
            </button>

            {/* User profile menu */}
            <div className="profile-menu-container">
              <button
                className="profile-btn"
                onClick={toggleProfileMenu}
                aria-label="User menu"
              >
                <div className="user-avatar">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="user-name desktop-only">{user?.name || 'User'}</span>
                <span className="dropdown-arrow">▼</span>
              </button>

              {profileMenuOpen && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="user-avatar-large">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="user-info">
                      <p className="user-name">{user?.name || 'User'}</p>
                      <p className="user-email">{user?.email || ''}</p>
                    </div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <Link href="/settings" className="profile-dropdown-item">
                    <span>⚙️</span> Settings
                  </Link>
                  <button
                    className="profile-dropdown-item"
                    onClick={handleLogout}
                  >
                    <span>🚪</span> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
