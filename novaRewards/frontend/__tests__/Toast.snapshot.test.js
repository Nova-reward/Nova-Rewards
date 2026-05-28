/**
 * Snapshot tests for Toast / ToastProvider — Issue #958
 *
 * Covers: all toast types (success, error, warning, info),
 * empty container, and multiple toasts.
 *
 * Updating snapshots: see Button.snapshot.test.js for policy.
 */
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../../components/Toast';

jest.useFakeTimers();

/** Helper: renders ToastProvider and triggers addToast via a button */
function ToastHarness({ message, type, duration = 0 }) {
  const { addToast } = useToast();
  return (
    <button onClick={() => addToast(message, type, duration)}>trigger</button>
  );
}

function renderWithToast(props) {
  return render(
    <ToastProvider>
      <ToastHarness {...props} />
    </ToastProvider>
  );
}

describe('Toast snapshots', () => {
  it('renders empty toast container', () => {
    const { container } = render(<ToastProvider><span /></ToastProvider>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders success toast', () => {
    const { container, getByText } = renderWithToast({ message: 'Saved!', type: 'success' });
    act(() => { fireEvent.click(getByText('trigger')); });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders error toast', () => {
    const { container, getByText } = renderWithToast({ message: 'Something went wrong', type: 'error' });
    act(() => { fireEvent.click(getByText('trigger')); });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders warning toast', () => {
    const { container, getByText } = renderWithToast({ message: 'Low balance', type: 'warning' });
    act(() => { fireEvent.click(getByText('trigger')); });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders info toast', () => {
    const { container, getByText } = renderWithToast({ message: 'Transaction pending', type: 'info' });
    act(() => { fireEvent.click(getByText('trigger')); });
    expect(container.firstChild).toMatchSnapshot();
  });
});
