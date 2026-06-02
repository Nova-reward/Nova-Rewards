/**
 * Tests for WalletConnectButton component and walletStore integration.
 *
 * Covers:
 *  - Idle state → "Connect Wallet" button
 *  - Connecting state → spinner + "Connecting…"
 *  - Connected state → address + balance + network badge + disconnect
 *  - Error state → error message + retry + dismiss
 *  - walletStore: connect, disconnect, signTransaction, rehydration, clearError
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import WalletConnectButton from '../components/WalletConnectButton';
import { useWalletStore } from '../store/walletStore';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
jest.mock('../lib/freighter', () => ({
  isFreighterInstalled: jest.fn(),
  connectWallet: jest.fn(),
  sign: jest.fn(),
  getNetworkPassphrase: jest.fn(() => 'Test SDF Network ; September 2015'),
}));

jest.mock('../lib/horizonClient', () => ({
  getNOVABalance: jest.fn(() => Promise.resolve('100.0000000')),
  getTransactionHistory: jest.fn(() => Promise.resolve([])),
}));

const { isFreighterInstalled, connectWallet, sign } = require('../lib/freighter');

// Helper to reset store between tests
function resetStore() {
  useWalletStore.setState({
    publicKey: null,
    walletType: null,
    network: 'testnet',
    balance: '0',
    transactions: [],
    freighterInstalled: null,
    isLoading: false,
    isSigning: false,
    error: null,
    hydrated: true,
  });
}

// ---------------------------------------------------------------------------
// Tests: WalletConnectButton component states
// ---------------------------------------------------------------------------
describe('WalletConnectButton — component states', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  it('renders "Connect Wallet" in idle state', () => {
    render(<WalletConnectButton />);
    const btn = screen.getByRole('button', { name: /connect wallet/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Connect Wallet');
  });

  it('renders "Connecting…" with spinner when loading', () => {
    useWalletStore.setState({ isLoading: true });
    render(<WalletConnectButton />);
    const btn = screen.getByRole('button', { name: /connecting/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Connecting');
  });

  it('renders wallet address, balance, and network badge when connected', () => {
    useWalletStore.setState({
      publicKey: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12',
      balance: '250.0000000',
      network: 'testnet',
    });

    render(<WalletConnectButton />);

    expect(screen.getByText(/GABCDE…EF12/)).toBeInTheDocument();
    expect(screen.getByText(/250 NOVA/)).toBeInTheDocument();
    expect(screen.getByText('Testnet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('shows "Mainnet" badge when on mainnet', () => {
    useWalletStore.setState({
      publicKey: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12',
      balance: '10',
      network: 'mainnet',
    });

    render(<WalletConnectButton />);
    expect(screen.getByText('Mainnet')).toBeInTheDocument();
  });

  it('renders error message with retry and dismiss when error is set and no publicKey', () => {
    useWalletStore.setState({
      error: 'Freighter wallet extension is not installed.',
    });

    render(<WalletConnectButton />);
    expect(screen.getByText(/not installed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('returns null when not yet hydrated', () => {
    useWalletStore.setState({ hydrated: false });
    const { container } = render(<WalletConnectButton />);
    expect(container.innerHTML).toBe('');
  });

  it('calls connect() when "Connect Wallet" is clicked', async () => {
    isFreighterInstalled.mockResolvedValue(true);
    connectWallet.mockResolvedValue('GTESTPUBLICKEY123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12');

    render(<WalletConnectButton />);
    const btn = screen.getByRole('button', { name: /connect wallet/i });
    await act(async () => { fireEvent.click(btn); });

    expect(connectWallet).toHaveBeenCalled();
  });

  it('calls disconnect() when disconnect button is clicked', () => {
    useWalletStore.setState({
      publicKey: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12',
      balance: '50',
    });

    render(<WalletConnectButton />);
    const btn = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(btn);

    expect(useWalletStore.getState().publicKey).toBeNull();
  });

  it('calls clearError() when dismiss is clicked', () => {
    useWalletStore.setState({ error: 'Some error' });

    render(<WalletConnectButton />);
    const dismiss = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismiss);

    expect(useWalletStore.getState().error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: walletStore actions
// ---------------------------------------------------------------------------
describe('walletStore — actions', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  it('connect() sets publicKey on successful connection', async () => {
    isFreighterInstalled.mockResolvedValue(true);
    connectWallet.mockResolvedValue('GTESTPUBLICKEY123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12');

    await useWalletStore.getState().connect();

    expect(useWalletStore.getState().publicKey).toBe('GTESTPUBLICKEY123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12');
    expect(useWalletStore.getState().walletType).toBe('freighter');
    expect(useWalletStore.getState().isLoading).toBe(false);
  });

  it('connect() sets error when Freighter is not installed', async () => {
    isFreighterInstalled.mockResolvedValue(false);

    await useWalletStore.getState().connect();

    expect(useWalletStore.getState().publicKey).toBeNull();
    expect(useWalletStore.getState().error).toContain('not installed');
  });

  it('connect() sets user-friendly error on access denied', async () => {
    isFreighterInstalled.mockResolvedValue(true);
    connectWallet.mockRejectedValue(new Error('Access denied by user'));

    await useWalletStore.getState().connect();

    expect(useWalletStore.getState().error).toContain('denied');
  });

  it('disconnect() clears all wallet state', () => {
    useWalletStore.setState({
      publicKey: 'GTEST',
      walletType: 'freighter',
      balance: '100',
    });

    useWalletStore.getState().disconnect();

    expect(useWalletStore.getState().publicKey).toBeNull();
    expect(useWalletStore.getState().walletType).toBeNull();
    expect(useWalletStore.getState().balance).toBe('0');
    expect(useWalletStore.getState().error).toBeNull();
  });

  it('signTransaction() returns signed XDR', async () => {
    useWalletStore.setState({ publicKey: 'GTEST' });
    sign.mockResolvedValue('SIGNED_XDR_123');

    const result = await useWalletStore.getState().signTransaction('UNSIGNED_XDR');

    expect(result).toBe('SIGNED_XDR_123');
    expect(sign).toHaveBeenCalledWith('UNSIGNED_XDR');
  });

  it('signTransaction() throws when no wallet is connected', async () => {
    useWalletStore.setState({ publicKey: null });

    await expect(
      useWalletStore.getState().signTransaction('XDR'),
    ).rejects.toThrow('No wallet connected');
  });

  it('signTransaction() sets error on signing failure', async () => {
    useWalletStore.setState({ publicKey: 'GTEST' });
    sign.mockRejectedValue(new Error('User rejected'));

    await expect(
      useWalletStore.getState().signTransaction('XDR'),
    ).rejects.toThrow();

    expect(useWalletStore.getState().error).toContain('rejected');
  });

  it('clearError() removes the error', () => {
    useWalletStore.setState({ error: 'Something went wrong' });
    useWalletStore.getState().clearError();
    expect(useWalletStore.getState().error).toBeNull();
  });

  it('rehydrate() refreshes balance for persisted publicKey', async () => {
    const { getNOVABalance, getTransactionHistory } = require('../lib/horizonClient');
    getNOVABalance.mockResolvedValue('500.0000000');
    getTransactionHistory.mockResolvedValue([{ id: 'tx1' }]);

    useWalletStore.setState({ publicKey: 'GPERSISTED', hydrated: false });

    await useWalletStore.getState().rehydrate();

    expect(useWalletStore.getState().balance).toBe('500.0000000');
    expect(useWalletStore.getState().transactions).toEqual([{ id: 'tx1' }]);
    expect(useWalletStore.getState().hydrated).toBe(true);
  });

  it('rehydrate() clears stale publicKey on failure', async () => {
    const { getNOVABalance } = require('../lib/horizonClient');
    getNOVABalance.mockRejectedValue(new Error('Network error'));

    useWalletStore.setState({ publicKey: 'GSTALE', hydrated: false });

    await useWalletStore.getState().rehydrate();

    expect(useWalletStore.getState().publicKey).toBeNull();
    expect(useWalletStore.getState().hydrated).toBe(true);
  });

  it('rehydrate() sets hydrated=true even with no publicKey', async () => {
    useWalletStore.setState({ publicKey: null, hydrated: false });

    await useWalletStore.getState().rehydrate();

    expect(useWalletStore.getState().hydrated).toBe(true);
  });
});
