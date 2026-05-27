import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CampaignCard from '../components/CampaignCard';

const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const past   = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const soon   = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

const baseCampaign = {
  name: 'Summer Rewards',
  description: 'Earn NOVA tokens this summer',
  category: 'retail',
  rewardType: 'cashback',
  rewardRate: 5,
  merchantName: 'Acme Corp',
  merchantLogo: null,
  endDate: future,
  status: 'active',
  participantCount: 120,
};

describe('CampaignCard — active campaign', () => {
  it('renders campaign name and merchant name', () => {
    render(<CampaignCard campaign={baseCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('Summer Rewards')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<CampaignCard campaign={baseCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('Earn NOVA tokens this summer')).toBeInTheDocument();
  });

  it('renders category and reward type chips', () => {
    render(<CampaignCard campaign={baseCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('retail')).toBeInTheDocument();
    expect(screen.getByText('cashback')).toBeInTheDocument();
  });

  it('renders reward rate', () => {
    render(<CampaignCard campaign={baseCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('NOVA')).toBeInTheDocument();
  });

  it('shows Active status badge', () => {
    render(<CampaignCard campaign={baseCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('● Active')).toBeInTheDocument();
  });

  it('shows participant count', () => {
    render(<CampaignCard campaign={baseCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('120 joined')).toBeInTheDocument();
  });

  it('renders enabled View Details button', () => {
    render(<CampaignCard campaign={baseCampaign} onViewDetails={jest.fn()} />);
    const btn = screen.getByRole('button', { name: /view details for summer rewards/i });
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('View Details →');
  });

  it('calls onViewDetails with campaign when button clicked', () => {
    const onViewDetails = jest.fn();
    render(<CampaignCard campaign={baseCampaign} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByRole('button', { name: /view details for summer rewards/i }));
    expect(onViewDetails).toHaveBeenCalledWith(baseCampaign);
  });
});

describe('CampaignCard — ended/completed campaign', () => {
  const endedCampaign = { ...baseCampaign, status: 'completed', endDate: past };

  it('shows Ended status badge', () => {
    render(<CampaignCard campaign={endedCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  it('shows Expired text in meta row', () => {
    render(<CampaignCard campaign={endedCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('disables the action button', () => {
    render(<CampaignCard campaign={endedCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByRole('button', { name: /view details for summer rewards/i })).toBeDisabled();
  });

  it('shows "Campaign Ended" button label', () => {
    render(<CampaignCard campaign={endedCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByRole('button', { name: /view details for summer rewards/i })).toHaveTextContent('Campaign Ended');
  });

  it('does not call onViewDetails when disabled button is clicked', () => {
    const onViewDetails = jest.fn();
    render(<CampaignCard campaign={endedCampaign} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByRole('button', { name: /view details for summer rewards/i }));
    expect(onViewDetails).not.toHaveBeenCalled();
  });
});

describe('CampaignCard — paused campaign', () => {
  const pausedCampaign = { ...baseCampaign, status: 'paused' };

  it('shows Paused status badge', () => {
    render(<CampaignCard campaign={pausedCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('⏸ Paused')).toBeInTheDocument();
  });

  it('renders enabled action button (paused is not expired)', () => {
    render(<CampaignCard campaign={pausedCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByRole('button', { name: /view details for summer rewards/i })).not.toBeDisabled();
  });
});

describe('CampaignCard — expiring soon', () => {
  const soonCampaign = { ...baseCampaign, endDate: soon };

  it('shows days remaining when expiring within 7 days', () => {
    render(<CampaignCard campaign={soonCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText(/in \dd/)).toBeInTheDocument();
  });
});

describe('CampaignCard — missing optional props', () => {
  it('renders without description', () => {
    const campaign = { ...baseCampaign, description: undefined };
    render(<CampaignCard campaign={campaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('Summer Rewards')).toBeInTheDocument();
  });

  it('renders without category', () => {
    const campaign = { ...baseCampaign, category: undefined };
    render(<CampaignCard campaign={campaign} onViewDetails={jest.fn()} />);
    expect(screen.queryByText('retail')).not.toBeInTheDocument();
  });

  it('renders without rewardType', () => {
    const campaign = { ...baseCampaign, rewardType: undefined };
    render(<CampaignCard campaign={campaign} onViewDetails={jest.fn()} />);
    expect(screen.queryByText('cashback')).not.toBeInTheDocument();
  });

  it('renders merchant initial when no logo', () => {
    render(<CampaignCard campaign={baseCampaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders merchant logo img when provided', () => {
    const campaign = { ...baseCampaign, merchantLogo: 'https://example.com/logo.png' };
    render(<CampaignCard campaign={campaign} onViewDetails={jest.fn()} />);
    expect(screen.getByAltText('Acme Corp logo')).toHaveAttribute('src', 'https://example.com/logo.png');
  });

  it('renders "Unknown Merchant" when merchantName is missing', () => {
    const campaign = { ...baseCampaign, merchantName: undefined };
    render(<CampaignCard campaign={campaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('Unknown Merchant')).toBeInTheDocument();
  });

  it('renders "No expiry" when endDate is null', () => {
    const campaign = { ...baseCampaign, endDate: null };
    render(<CampaignCard campaign={campaign} onViewDetails={jest.fn()} />);
    expect(screen.getByText('No expiry')).toBeInTheDocument();
  });

  it('does not show participant count when participantCount is 0', () => {
    const campaign = { ...baseCampaign, participantCount: 0 };
    render(<CampaignCard campaign={campaign} onViewDetails={jest.fn()} />);
    expect(screen.queryByText(/joined/)).not.toBeInTheDocument();
  });
});
