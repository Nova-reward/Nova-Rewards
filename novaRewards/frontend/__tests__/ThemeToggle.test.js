import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThemeToggle from '../components/ThemeToggle';
import { ThemeProvider } from '../context/ThemeContext';

// ThemeProvider reads localStorage and matchMedia on mount
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockReturnValue({ matches: false }),
  });
});

function renderWithTheme(ui) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('ThemeToggle', () => {
  test('renders toggle button with aria-label', () => {
    renderWithTheme(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });

  test('shows moon icon in light mode', () => {
    renderWithTheme(<ThemeToggle />);
    expect(screen.getByRole('button')).toHaveTextContent('🌙');
  });

  test('shows sun icon after switching to dark mode', () => {
    renderWithTheme(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('☀️');
  });

  test('title reflects the next theme to switch to', () => {
    renderWithTheme(<ThemeToggle />);
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Switch to dark mode');
  });

  test('persists theme to localStorage on toggle', () => {
    renderWithTheme(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  test('reads stored theme from localStorage', () => {
    localStorage.setItem('theme', 'dark');
    renderWithTheme(<ThemeToggle />);
    expect(screen.getByRole('button')).toHaveTextContent('☀️');
  });
});
