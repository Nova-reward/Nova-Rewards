import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StakePositionCard from '../../components/staking/StakePositionCard';

describe('StakePositionCard', () => {
  const mockOnUnstake = jest.fn();
  const mockOnClaimRewards = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state when no stake position', () => {
    render(
      <StakePositionCard
        stakePosition={null}
        onUnstake={mockOnUnstake}
        onClaimRewards={mockOnClaimRewards}
        isLoading={false}
      />
    );

    expect(screen.getByText(/no active stake/i)).toBeInTheDocument();
    expect(screen.getByText(/stake your nova tokens to start earning rewards/i)).toBeInTheDocument();
  });

  it('displays active stake position correctly', () => {
    const stakePosition = {
      stakedAmount: 1000,
      accruedRewards: 50.5,
      stakedAt: new Date('2024-01-01'),
      status: 'active',
      cooldownEnd: null,
    };

    render(
      <StakePositionCard
        stakePosition={stakePosition}
        onUnstake={mockOnUnstake}
        onClaimRewards={mockOnClaimRewards}
        isLoading={false}
      />
    );

    expect(screen.getByText(/active stake position/i)).toBeInTheDocument();
    expect(screen.getByText('1000.00')).toBeInTheDocument();
    expect(screen.getByText('+50.5000')).toBeInTheDocument();
    expect(screen.getByText('1050.50')).toBeInTheDocument(); // Total value
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('shows cooldown status when in cooldown period', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
    const stakePosition = {
      stakedAmount: 1000,
      accruedRewards: 50,
      stakedAt: new Date('2024-01-01'),
      status: 'cooldown',
      cooldownEnd: futureDate.toISOString(),
    };

    render(
      <StakePositionCard
        stakePosition={stakePosition}
        onUnstake={mockOnUnstake}
        onClaimRewards={mockOnClaimRewards}
        isLoading={false}
      />
    );

    expect(screen.getByText(/cooldown period active/i)).toBeInTheDocument();
    expect(screen.getByText(/time remaining/i)).toBeInTheDocument();
  });

  it('calls onClaimRewards when claim button is clicked', () => {
    const stakePosition = {
      stakedAmount: 1000,
      accruedRewards: 50,
      stakedAt: new Date('2024-01-01'),
      status: 'active',
      cooldownEnd: null,
    };

    render(
      <StakePositionCard
        stakePosition={stakePosition}
        onUnstake={mockOnUnstake}
        onClaimRewards={mockOnClaimRewards}
        isLoading={false}
      />
    );

    const claimButton = screen.getByRole('button', { name: /claim rewards/i });
    fireEvent.click(claimButton);

    expect(mockOnClaimRewards).toHaveBeenCalled();
  });

  it('calls onUnstake when unstake button is clicked', () => {
    const stakePosition = {
      stakedAmount: 1000,
      accruedRewards: 50,
      stakedAt: new Date('2024-01-01'),
      status: 'active',
      cooldownEnd: null,
    };

    render(
      <StakePositionCard
        stakePosition={stakePosition}
        onUnstake={mockOnUnstake}
        onClaimRewards={mockOnClaimRewards}
        isLoading={false}
      />
    );

    const unstakeButton = screen.getByRole('button', { name: /unstake/i });
    fireEvent.click(unstakeButton);

    expect(mockOnUnstake).toHaveBeenCalled();
  });

  it('disables claim button when no rewards', () => {
    const stakePosition = {
      stakedAmount: 1000,
      accruedRewards: 0,
      stakedAt: new Date(),
      status: 'active',
      cooldownEnd: null,
    };

    render(
      <StakePositionCard
        stakePosition={stakePosition}
        onUnstake={mockOnUnstake}
        onClaimRewards={mockOnClaimRewards}
        isLoading={false}
      />
    );

    const claimButton = screen.getByRole('button', { name: /claim rewards/i });
    expect(claimButton).toBeDisabled();
  });

  it('disables buttons when loading', () => {
    const stakePosition = {
      stakedAmount: 1000,
      accruedRewards: 50,
      stakedAt: new Date('2024-01-01'),
      status: 'active',
      cooldownEnd: null,
    };

    render(
      <StakePositionCard
        stakePosition={stakePosition}
        onUnstake={mockOnUnstake}
        onClaimRewards={mockOnClaimRewards}
        isLoading={true}
      />
    );

    const claimButton = screen.getByRole('button', { name: /processing/i });
    const unstakeButton = screen.getAllByRole('button')[1];

    expect(claimButton).toBeDisabled();
    expect(unstakeButton).toBeDisabled();
  });

  it('shows ready to unstake when cooldown is complete', () => {
    const pastDate = new Date(Date.now() - 1000); // 1 second ago
    const stakePosition = {
      stakedAmount: 1000,
      accruedRewards: 50,
      stakedAt: new Date('2024-01-01'),
      status: 'cooldown',
      cooldownEnd: pastDate.toISOString(),
    };

    render(
      <StakePositionCard
        stakePosition={stakePosition}
        onUnstake={mockOnUnstake}
        onClaimRewards={mockOnClaimRewards}
        isLoading={false}
      />
    );

    expect(screen.getByText(/ready to unstake/i)).toBeInTheDocument();
  });

  it('calculates days staked correctly', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const stakePosition = {
      stakedAmount: 1000,
      accruedRewards: 50,
      stakedAt: thirtyDaysAgo,
      status: 'active',
      cooldownEnd: null,
    };

    render(
      <StakePositionCard
        stakePosition={stakePosition}
        onUnstake={mockOnUnstake}
        onClaimRewards={mockOnClaimRewards}
        isLoading={false}
      />
    );

    expect(screen.getByText(/30 days ago/i)).toBeInTheDocument();
  });
});
