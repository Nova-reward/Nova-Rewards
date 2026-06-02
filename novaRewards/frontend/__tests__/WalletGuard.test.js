import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useRouter } from 'next/router';
import WalletGuard from '../components/WalletGuard';
import { useWallet } from '../context/WalletContext';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock WalletContext
jest.mock('../context/WalletContext', () => ({
  useWallet: jest.fn(),
}));

// Mock LoadingSkeleton
jest.mock('../components/LoadingSkeleton', () => {
  return function LoadingSkeleton() {
    return <div>Loading...</div>;
  };
});

describe('WalletGuard', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
    asPath: '/protected-page',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue(mockRouter);
    
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  it('renders children when wallet is connected', () => {
    useWallet.mockReturnValue({
      publicKey: 'GXXXXXXXXX',
      loading: false,
    });

    render(
      <WalletGuard>
        <div>Protected Content</div>
      </WalletGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows loading state while checking wallet connection', () => {
    useWallet.mockReturnValue({
      publicKey: null,
      loading: true,
    });

    render(
      <WalletGuard>
        <div>Protected Content</div>
      </WalletGuard>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to wallet-not-connected when wallet is not connected', async () => {
    useWallet.mockReturnValue({
      publicKey: null,
      loading: false,
    });

    render(
      <WalletGuard>
        <div>Protected Content</div>
      </WalletGuard>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/wallet-not-connected');
    });

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      'redirectAfterWallet',
      '/protected-page'
    );
  });

  it('uses custom redirect path when provided', async () => {
    useWallet.mockReturnValue({
      publicKey: null,
      loading: false,
    });

    render(
      <WalletGuard redirectTo="/custom-error">
        <div>Protected Content</div>
      </WalletGuard>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/custom-error');
    });
  });

  it('does not render children when wallet is not connected', () => {
    useWallet.mockReturnValue({
      publicKey: null,
      loading: false,
    });

    render(
      <WalletGuard>
        <div>Protected Content</div>
      </WalletGuard>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('stores intended destination in sessionStorage', async () => {
    useWallet.mockReturnValue({
      publicKey: null,
      loading: false,
    });

    render(
      <WalletGuard>
        <div>Protected Content</div>
      </WalletGuard>
    );

    await waitFor(() => {
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
        'redirectAfterWallet',
        '/protected-page'
      );
    });
  });
});
