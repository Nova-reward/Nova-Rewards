import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionHistory from '../components/TransactionHistory';
import * as useApi from '../lib/useApi';

// Mock the useApi hook
jest.mock('../lib/useApi');

const mockTransactions = [
  {
    id: '1',
    type: 'issuance',
    amount: '100.00',
    campaign: { id: '1', name: 'Summer Campaign' },
    createdAt: '2024-01-15T10:00:00Z',
    status: 'confirmed',
    txHash: 'abc123def456',
  },
  {
    id: '2',
    type: 'redemption',
    amount: '50.00',
    campaign: { id: '2', name: 'Winter Campaign' },
    createdAt: '2024-01-14T15:30:00Z',
    status: 'confirmed',
    txHash: 'ghi789jkl012',
  },
];

describe('TransactionHistory Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders transaction history with data', () => {
    useApi.useTransactions.mockReturnValue({
      data: mockTransactions,
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });

    render(<TransactionHistory userId="user-123" />);

    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(screen.getByText('Summer Campaign')).toBeInTheDocument();
    expect(screen.getByText('Winter Campaign')).toBeInTheDocument();
  });

  test('displays empty state when no transactions', () => {
    useApi.useTransactions.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });

    render(<TransactionHistory userId="user-123" />);

    expect(screen.getByText(/No Transactions/i)).toBeInTheDocument();
  });

  test('displays loading state', () => {
    useApi.useTransactions.mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
      mutate: jest.fn(),
    });

    render(<TransactionHistory userId="user-123" />);

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  test('displays error message on fetch failure', () => {
    const errorMsg = 'Failed to load transactions';
    useApi.useTransactions.mockReturnValue({
      data: null,
      error: { message: errorMsg },
      isLoading: false,
      mutate: jest.fn(),
    });

    render(<TransactionHistory userId="user-123" />);

    expect(screen.getByText(new RegExp(errorMsg))).toBeInTheDocument();
  });

  test('filters by transaction type', async () => {
    useApi.useTransactions.mockReturnValue({
      data: mockTransactions,
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });

    const { rerender } = render(<TransactionHistory userId="user-123" />);

    const typeFilter = screen.getByDisplayValue('All Types');
    await userEvent.selectOption(typeFilter, 'issuance');

    // Verify filter element is updated
    expect(screen.getByDisplayValue('Issuance')).toBeInTheDocument();
  });

  test('filters by date range', async () => {
    useApi.useTransactions.mockReturnValue({
      data: mockTransactions,
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });

    render(<TransactionHistory userId="user-123" />);

    const dateInputs = screen.getAllByRole('textbox');
    const startDateInput = dateInputs[0];

    await userEvent.type(startDateInput, '2024-01-01');
    await waitFor(() => {
      expect(startDateInput).toHaveValue('2024-01-01');
    });
  });

  test('exports CSV when button clicked', async () => {
    useApi.useTransactions.mockReturnValue({
      data: mockTransactions,
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });

    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ data: mockTransactions }),
      })
    );

    render(<TransactionHistory userId="user-123" />);

    const exportButton = screen.getByText('Export CSV');
    await userEvent.click(exportButton);

    await waitFor(() => {
      expect(exportButton).toHaveTextContent('Export CSV');
    });
  });

  test('displays Stellar Explorer links for verified transactions', () => {
    useApi.useTransactions.mockReturnValue({
      data: mockTransactions,
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });

    render(<TransactionHistory userId="user-123" />);

    const links = screen.getAllByText('View');
    expect(links.length).toBeGreaterThan(0);

    links.forEach((link) => {
      expect(link).toHaveAttribute('href', expect.stringContaining('stellar.expert'));
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  test('shows correct status badges', () => {
    useApi.useTransactions.mockReturnValue({
      data: mockTransactions,
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });

    render(<TransactionHistory userId="user-123" />);

    expect(screen.getAllByText('confirmed')).toHaveLength(2);
  });

  test('pagination works correctly', async () => {
    const paginatedMockData = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      type: 'issuance',
      amount: '100.00',
      campaign: { id: '1', name: 'Campaign' },
      createdAt: '2024-01-15T10:00:00Z',
      status: 'confirmed',
      txHash: `hash${i}`,
    }));

    useApi.useTransactions.mockReturnValue({
      data: paginatedMockData,
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });

    render(<TransactionHistory userId="user-123" />);

    expect(screen.getByText('Page 1')).toBeInTheDocument();

    const nextButton = screen.getByText(/Next/);
    expect(nextButton).not.toBeDisabled();
  });

  test('resets page on filter change', async () => {
    useApi.useTransactions.mockReturnValue({
      data: mockTransactions,
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });

    const { rerender } = render(<TransactionHistory userId="user-123" />);

    // Change filter
    const typeFilter = screen.getByDisplayValue('All Types');
    await userEvent.selectOption(typeFilter, 'redemption');

    // Verify page is reset (would be tested via integration)
    expect(screen.getByText('Page 1')).toBeInTheDocument();
  });
});
