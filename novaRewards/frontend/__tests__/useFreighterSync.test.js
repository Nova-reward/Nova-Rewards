/**
 * Tests for useFreighterSync hook.
 *
 * Covers:
 *  - Switching Freighter to a different account triggers forced logout
 *    if the new account is not authenticated with the backend.
 *  - Switching Freighter to Mainnet while the app is configured for Testnet
 *    shows a clear network-mismatch error (not a silent failure).
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import useFreighterSync from '../hooks/useFreighterSync';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogout = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('../store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../store/walletStore', () => ({
  useWalletStore: jest.fn(),
}));

jest.mock('../lib/freighter', () => ({
  getFreighterPublicKey: jest.fn(),
  getFreighterNetwork: jest.fn(),
  checkNetworkMismatch: jest.fn(),
}));

const { getFreighterNetwork, checkNetworkMismatch } = require('../lib/freighter');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockFreighter() {
  const listeners = {};
  return {
    on: jest.fn((event, handler) => {
      listeners[event] = handler;
    }),
    off: jest.fn((event, handler) => {
      delete listeners[event];
    }),
    trigger: (event, payload) => {
      if (listeners[event]) {
        listeners[event](payload);
      }
    },
  };
}

function setupAuthStore(overrides = {}) {
  const defaults = {
    user: { id: 1, email: 'test@example.com', stellarPublicKey: 'GAUTHENTICATEDKEY123456789' },
    isAuthenticated: true,
    logout: mockLogout,
    updateUser: mockUpdateUser,
  };
  useAuthStore.mockImplementation((selector) => {
    const state = { ...defaults, ...overrides };
    return selector ? selector(state) : state;
  });
}

function setupWalletStore(overrides = {}) {
  const defaults = {
    publicKey: 'GAUTHENTICATEDKEY123456789',
    networkMismatch: false,
    freighterNetwork: null,
    error: null,
  };
  const setState = jest.fn((partial) => {
    Object.assign(defaults, partial);
  });
  useWalletStore.mockImplementation((selector) => {
    const state = { ...defaults, ...overrides, setState };
    return selector ? selector(state) : state;
  });
  return setState;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFreighterSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
    mockUpdateUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // Account change scenarios
  // -------------------------------------------------------------------------

  describe('accountChanged event', () => {
    it('forces logout when Freighter switches to a different, unauthenticated account', async () => {
      const newAccount = 'GDIFFERENTACCOUNT123456789ABCDEF';
      const freighter = createMockFreighter();
      window.freighter = freighter;

      setupAuthStore();
      const walletSetState = setupWalletStore();

      renderHook(() => useFreighterSync());

      // Simulate account change
      await act(async () => {
        freighter.trigger('accountChanged', newAccount);
      });

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(walletSetState).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: newAccount,
          error: 'Wallet account changed. Please log in again.',
        }),
        expect.any(Boolean),
        'wallet/accountChangedLogout',
      );
    });

    it('does not logout when Freighter switches to the same authenticated account', async () => {
      const sameAccount = 'GAUTHENTICATEDKEY123456789';
      const freighter = createMockFreighter();
      window.freighter = freighter;

      setupAuthStore();
      const walletSetState = setupWalletStore({ publicKey: 'GOLDKEY123' });

      renderHook(() => useFreighterSync());

      await act(async () => {
        freighter.trigger('accountChanged', sameAccount);
      });

      expect(mockLogout).not.toHaveBeenCalled();
      // Wallet store should be updated to the new key
      expect(walletSetState).toHaveBeenCalledWith(
        expect.objectContaining({ publicKey: sameAccount }),
        expect.any(Boolean),
        expect.any(String),
      );
    });

    it('updates wallet publicKey when not authenticated', async () => {
      const newAccount = 'GUNKNOWNACCOUNT123456789ABCDEF';
      const freighter = createMockFreighter();
      window.freighter = freighter;

      setupAuthStore({ isAuthenticated: false, user: null });
      const walletSetState = setupWalletStore();

      renderHook(() => useFreighterSync());

      await act(async () => {
        freighter.trigger('accountChanged', newAccount);
      });

      expect(mockLogout).not.toHaveBeenCalled();
      expect(walletSetState).toHaveBeenCalledWith(
        expect.objectContaining({ publicKey: newAccount }),
        expect.any(Boolean),
        'wallet/accountChanged',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Network change scenarios
  // -------------------------------------------------------------------------

  describe('networkChanged event', () => {
    it('shows a clear network-mismatch error when Freighter switches to Mainnet on a Testnet app', async () => {
      const freighter = createMockFreighter();
      window.freighter = freighter;

      getFreighterNetwork.mockResolvedValue({
        network: 'PUBLIC',
        networkPassphrase: 'Public Global Stellar Network ; September 2015',
      });
      checkNetworkMismatch.mockResolvedValue(true);

      setupAuthStore();
      const walletSetState = setupWalletStore();

      renderHook(() => useFreighterSync());

      await act(async () => {
        freighter.trigger('networkChanged');
      });

      await waitFor(() => {
        expect(walletSetState).toHaveBeenCalledWith(
          expect.objectContaining({
            freighterNetwork: 'PUBLIC',
            networkMismatch: true,
            error: expect.stringContaining('Network mismatch'),
          }),
          expect.any(Boolean),
          expect.any(String),
        );
      });
    });

    it('clears network mismatch when Freighter switches back to the expected network', async () => {
      const freighter = createMockFreighter();
      window.freighter = freighter;

      getFreighterNetwork.mockResolvedValue({
        network: 'TESTNET',
        networkPassphrase: 'Test SDF Network ; September 2015',
      });
      checkNetworkMismatch.mockResolvedValue(false);

      setupAuthStore();
      const walletSetState = setupWalletStore({ networkMismatch: true, error: 'Network mismatch' });

      renderHook(() => useFreighterSync());

      await act(async () => {
        freighter.trigger('networkChanged');
      });

      await waitFor(() => {
        expect(walletSetState).toHaveBeenCalledWith(
          expect.objectContaining({
            freighterNetwork: 'TESTNET',
            networkMismatch: false,
          }),
          expect.any(Boolean),
          expect.any(String),
        );
      });
    });

    it('sets an error when Freighter network cannot be read after switch', async () => {
      const freighter = createMockFreighter();
      window.freighter = freighter;

      getFreighterNetwork.mockRejectedValue(new Error('Network read failed'));
      checkNetworkMismatch.mockResolvedValue(false);

      setupAuthStore();
      const walletSetState = setupWalletStore();

      renderHook(() => useFreighterSync());

      await act(async () => {
        freighter.trigger('networkChanged');
      });

      await waitFor(() => {
        expect(walletSetState).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Could not verify Freighter network after switch.',
          }),
          expect.any(Boolean),
          'wallet/networkReadFailed',
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle / cleanup
  // -------------------------------------------------------------------------

  describe('lifecycle', () => {
    it('subscribes to Freighter events on mount and unsubscribes on unmount', () => {
      const freighter = createMockFreighter();
      window.freighter = freighter;

      setupAuthStore();
      setupWalletStore();

      const { unmount } = renderHook(() => useFreighterSync());

      expect(freighter.on).toHaveBeenCalledWith('accountChanged', expect.any(Function));
      expect(freighter.on).toHaveBeenCalledWith('networkChanged', expect.any(Function));

      unmount();

      expect(freighter.off).toHaveBeenCalledWith('accountChanged', expect.any(Function));
      expect(freighter.off).toHaveBeenCalledWith('networkChanged', expect.any(Function));
    });

    it('is a no-op when Freighter is not available', () => {
      window.freighter = undefined;

      setupAuthStore();
      setupWalletStore();

      const { unmount } = renderHook(() => useFreighterSync());

      // Should not throw
      expect(() => unmount()).not.toThrow();
    });

    it('is a no-op when Freighter does not implement on()', () => {
      window.freighter = {};

      setupAuthStore();
      setupWalletStore();

      const { unmount } = renderHook(() => useFreighterSync());

      expect(() => unmount()).not.toThrow();
    });
  });
});