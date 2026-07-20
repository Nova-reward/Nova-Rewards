import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionHistory from '../components/TransactionHistory';
import * as useInfiniteScrollModule from '../hooks/useInfiniteScroll';
import * as useScrollRestorationModule from '../hooks/useScrollRestoration';

jest.mock('../hooks/useInfiniteScroll');
jest.mock('../hooks/useScrollRestoration', () => ({
  useScrollRestoration: jest.fn(),
}));

const mockItems = [
  {
    id: '1',
    action_type: 'issuance',
    amount: '100.00',
    campaign_name: 'Summer Campaign',
    timestamp: '2024-01-15T10:00:00Z',
    status: 'confirmed',
    tx_hash: 'abc123def456',
  },
  {
    id: '2',
    action_type: 'redemption',
    amount: '50.00',
    campaign_name: 'Winter Campaign',
    timestamp: '2024-01-14T15:30:00Z',
    status: 'confirmed',
    tx_hash: 'ghi789jkl012',
  },
];

function mockScroll(overrides = {}) {
  useInfiniteScrollModule.useInfiniteScroll.mockReturnValue({
    items: mockItems,
    loading: false,
    error: null,
    hasMore: true,
    loadMore: jest.fn(),
    retry: jest.fn(),
    ...overrides,
  });
  useInfiniteScrollModule.useSentinel.mockReturnValue({ current: null });
}

describe('TransactionHistory Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useScrollRestorationModule.useScrollRestoration.mockImplementation(() => {});
  });

  test('renders transaction list', () => {
    mockScroll();
    render(<TransactionHistory userId="user-123" />);
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(screen.getByText('Summer Campaign')).toBeInTheDocument();
    expect(screen.getByText('Winter Campaign')).toBeInTheDocument();
  });

  test('shows initial loading skeleton when items is empty', () => {
    mockScroll({ items: [], loading: true });
    render(<TransactionHistory userId="user-123" />);
    // SkeletonTransactionHistory renders; no list items
    expect(screen.queryByText('Summer Campaign')).not.toBeInTheDocument();
  });

  test('shows empty state when no transactions', () => {
    mockScroll({ items: [], loading: false, hasMore: false });
    render(<TransactionHistory userId="user-123" />);
    expect(screen.getByText(/No transactions yet/i)).toBeInTheDocument();
  });

  test('shows error state with retry button when initial load fails', () => {
    mockScroll({ items: [], loading: false, error: 'Network error' });
    render(<TransactionHistory userId="user-123" />);
    expect(screen.getByText(/Failed to load transactions/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  test('calls retry when retry button clicked', async () => {
    const retry = jest.fn();
    mockScroll({ items: [], loading: false, error: 'Network error', retry });
    render(<TransactionHistory userId="user-123" />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('shows loading spinner during subsequent page loads', () => {
    mockScroll({ loading: true });
    render(<TransactionHistory userId="user-123" />);
    expect(screen.getByRole('status', { name: /loading more/i })).toBeInTheDocument();
  });

  test('shows "All transactions loaded" when hasMore is false', () => {
    mockScroll({ hasMore: false, loading: false });
    render(<TransactionHistory userId="user-123" />);
    expect(screen.getByText(/All transactions loaded/i)).toBeInTheDocument();
  });

  test('renders Stellar Explorer links for transactions with tx_hash', () => {
    mockScroll();
    render(<TransactionHistory userId="user-123" />);
    const links = screen.getAllByText('View');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link).toHaveAttribute('href', expect.stringContaining('stellar.expert'));
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  test('shows inline error with retry on subsequent page failure', () => {
    const retry = jest.fn();
    mockScroll({ error: 'Timeout', retry });
    render(<TransactionHistory userId="user-123" />);
    expect(screen.getByText(/Failed to load more/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
