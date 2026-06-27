import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThemeToggle from '../components/ThemeToggle';

// Mock next-themes
const mockSetTheme = jest.fn();
let mockResolvedTheme = 'light';

jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme, setTheme: mockSetTheme }),
}));

beforeEach(() => {
  mockResolvedTheme = 'light';
  mockSetTheme.mockClear();
});

describe('ThemeToggle', () => {
  test('renders toggle button with aria-label', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });

  test('shows moon icon in light mode', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toHaveTextContent('🌙');
  });

  test('shows sun icon in dark mode', () => {
    mockResolvedTheme = 'dark';
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toHaveTextContent('☀️');
  });

  test('title reflects the next theme to switch to', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Switch to dark mode');
  });

  test('calls setTheme with dark when in light mode', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  test('calls setTheme with light when in dark mode', () => {
    mockResolvedTheme = 'dark';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });
});
