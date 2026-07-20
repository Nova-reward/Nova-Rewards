/**
 * Edge Case Tests — Issue #944 (frontend)
 * @tags edge-case
 *
 * Covers: null/undefined/empty props in CampaignCard and TransactionHistory.
 */

import { render, screen } from '@testing-library/react';
import CampaignCard from '../components/CampaignCard';
import TransactionHistory from '../components/TransactionHistory';
import * as useApiModule from '../lib/useApi';

jest.mock('../lib/useApi');

// Minimal campaign fixture
const baseCampaign = {
  name: 'Test Campaign',
  description: 'A description',
  category: 'Retail',
  rewardType: 'token',
  rewardRate: '10',
  merchantName: 'Acme',
  merchantLogo: null,
  endDate: null,
  status: 'active',
  participantCount: 0,
};

describe('CampaignCard edge cases (#944)', () => {
  test('renders with null description without crashing', () => {
    render(<CampaignCard campaign={{ ...baseCampaign, description: null }} onViewDetails={jest.fn()} />);
    expect(screen.getByText('Test Campaign')).toBeInTheDocument();
  });

  test('renders with zero rewardRate', () => {
    render(<CampaignCard campaign={{ ...baseCampaign, rewardRate: '0' }} onViewDetails={jest.fn()} />);
    expect(screen.getByText('Test Campaign')).toBeInTheDocument();
  });

  test('renders with null endDate without crashing', () => {
    render(<CampaignCard campaign={{ ...baseCampaign, endDate: null }} onViewDetails={jest.fn()} />);
    expect(screen.getByText('Test Campaign')).toBeInTheDocument();
  });

  test('renders with null merchantLogo without crashing', () => {
    render(<CampaignCard campaign={{ ...baseCampaign, merchantLogo: null }} onViewDetails={jest.fn()} />);
    expect(screen.getByText('Test Campaign')).toBeInTheDocument();
  });

  test('renders with zero participantCount', () => {
    render(<CampaignCard campaign={{ ...baseCampaign, participantCount: 0 }} onViewDetails={jest.fn()} />);
    expect(screen.getByText('Test Campaign')).toBeInTheDocument();
  });
});

describe('TransactionHistory edge cases (#944)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders empty state when data is empty array', () => {
    useApiModule.useTransactions.mockReturnValue({ data: [], error: null, isLoading: false, mutate: jest.fn() });
    render(<TransactionHistory userId="u1" />);
    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });

  test('renders empty state when data is null', () => {
    useApiModule.useTransactions.mockReturnValue({ data: null, error: null, isLoading: false, mutate: jest.fn() });
    render(<TransactionHistory userId="u1" />);
    // Should not crash — either shows empty state or loading
    expect(document.body).toBeTruthy();
  });

  test('renders transaction with zero amount without crashing', () => {
    useApiModule.useTransactions.mockReturnValue({
      data: [{ id: '1', type: 'issuance', amount: '0', campaign: { id: '1', name: 'Camp' }, createdAt: '2024-01-01T00:00:00Z', status: 'confirmed', txHash: 'abc' }],
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });
    render(<TransactionHistory userId="u1" />);
    expect(screen.getByText('Camp')).toBeInTheDocument();
  });

  test('renders transaction with null campaign without crashing', () => {
    useApiModule.useTransactions.mockReturnValue({
      data: [{ id: '2', type: 'issuance', amount: '10', campaign: null, createdAt: '2024-01-01T00:00:00Z', status: 'confirmed', txHash: 'def' }],
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });
    render(<TransactionHistory userId="u1" />);
    expect(document.body).toBeTruthy();
  });

  test('renders transaction with undefined txHash without crashing', () => {
    useApiModule.useTransactions.mockReturnValue({
      data: [{ id: '3', type: 'redemption', amount: '5', campaign: { id: '1', name: 'Camp' }, createdAt: '2024-01-01T00:00:00Z', status: 'confirmed', txHash: undefined }],
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    });
    render(<TransactionHistory userId="u1" />);
    expect(document.body).toBeTruthy();
  });
});
