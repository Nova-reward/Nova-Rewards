import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastProvider, useToast } from '../components/Toast';

jest.useFakeTimers();

function ToastTrigger({ message, type, duration }) {
  const { addToast, removeToast } = useToast();
  return (
    <>
      <button onClick={() => addToast(message, type, duration)}>Add Toast</button>
      <button onClick={() => removeToast(0)}>Remove</button>
    </>
  );
}

function renderWithToast(props = {}) {
  return render(
    <ToastProvider>
      <ToastTrigger message="Hello!" type="success" duration={3000} {...props} />
    </ToastProvider>
  );
}

describe('Toast / ToastProvider', () => {
  test('renders children without any toasts initially', () => {
    renderWithToast();
    expect(screen.queryByText('Hello!')).not.toBeInTheDocument();
  });

  test('shows toast message after addToast is called', () => {
    renderWithToast();
    fireEvent.click(screen.getByText('Add Toast'));
    expect(screen.getByText('Hello!')).toBeInTheDocument();
  });

  test('applies correct type class to toast', () => {
    renderWithToast();
    fireEvent.click(screen.getByText('Add Toast'));
    expect(document.querySelector('.toast-success')).toBeInTheDocument();
  });

  test('toast disappears after duration', () => {
    renderWithToast();
    fireEvent.click(screen.getByText('Add Toast'));
    act(() => jest.advanceTimersByTime(3000));
    expect(screen.queryByText('Hello!')).not.toBeInTheDocument();
  });

  test('close button removes toast immediately', () => {
    renderWithToast();
    fireEvent.click(screen.getByText('Add Toast'));
    fireEvent.click(screen.getByRole('button', { name: /close notification/i }));
    expect(screen.queryByText('Hello!')).not.toBeInTheDocument();
  });

  test('close button has accessible aria-label', () => {
    renderWithToast();
    fireEvent.click(screen.getByText('Add Toast'));
    expect(screen.getByRole('button', { name: 'Close notification' })).toBeInTheDocument();
  });

  test('toast persists when duration is 0', () => {
    renderWithToast({ duration: 0 });
    fireEvent.click(screen.getByText('Add Toast'));
    act(() => jest.advanceTimersByTime(10000));
    expect(screen.getByText('Hello!')).toBeInTheDocument();
  });

  test('useToast throws when used outside ToastProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function BadComponent() {
      useToast();
      return null;
    }
    expect(() => render(<BadComponent />)).toThrow('useToast must be used within ToastProvider');
    spy.mockRestore();
  });
});
