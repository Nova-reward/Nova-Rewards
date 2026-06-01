import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Dropdown — WAI-ARIA menu button pattern.
 *
 * @param {React.ReactNode} trigger  — button content
 * @param {React.ReactNode} children — DropdownItem / DropdownDivider elements
 * @param {string}          align    — 'left' | 'right' (menu alignment)
 * @param {string}          className
 */
export function Dropdown({ trigger, children, align = 'left', className = '' }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (!menuRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Arrow key navigation + Escape
  function handleMenuKeyDown(e) {
    const items = Array.from(
      menuRef.current?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])') ?? []
    );
    const idx = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  }

  function handleTriggerKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
      // Focus first item after render
      setTimeout(() => {
        menuRef.current?.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
      }, 0);
    }
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 transition-colors"
      >
        {trigger}
        <svg
          className={`h-4 w-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <ul
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          onKeyDown={handleMenuKeyDown}
          className={`absolute z-50 mt-1 min-w-[10rem] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg py-1 focus:outline-none ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children}
        </ul>
      )}
    </div>
  );
}

/**
 * DropdownItem — a single menu item.
 *
 * @param {() => void}      onClick
 * @param {React.ReactNode} icon      — optional leading icon
 * @param {boolean}         disabled
 * @param {string}          className
 */
export function DropdownItem({ onClick, icon, disabled = false, className = '', children }) {
  return (
    <li role="none">
      <button
        role="menuitem"
        type="button"
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
        className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus-visible:outline-none focus-visible:bg-neutral-100 dark:focus-visible:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${className}`}
      >
        {icon && <span className="h-4 w-4 shrink-0" aria-hidden="true">{icon}</span>}
        {children}
      </button>
    </li>
  );
}

/** DropdownDivider — visual separator between groups of items. */
export function DropdownDivider() {
  return <li role="separator" className="my-1 border-t border-neutral-200 dark:border-neutral-700" />;
}

export default Dropdown;
