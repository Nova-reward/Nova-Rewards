import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StakeForm from '../../components/staking/StakeForm';
import { useWallet } from '../../context/WalletContext';

jest.mock('../../context/WalletContext', () => ({
  useWallet: jest.fn(),
}));

describe('StakeForm', () => {
  const mockOnStake = jest.fn();
  const mockPublicKey = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

  beforeEach(() => {
    jest.clearAllMocks();
    useWallet.mockReturnValue({
      publicKey: mockPublicKey,
    });
  });

  it('renders stake form with all elements', () => {
    render(
      <StakeForm balance={1000} onStake={mockOnStake} isLoading={false} />
    );

    expect(screen.getByLabelText(/amount to stake/i)).toBeInTheDocument();
    expect(screen.getByText(/MAX/i)).toBeInTheDocument();
    expect(screen.getByText(/Available: 1000.00 NOVA/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stake tokens/i })).toBeInTheDocument();
  });

  it('allows user to input stake amount', () => {
    render(
      <StakeForm balance={1000} onStake={mockOnStake} isLoading={false} />
    );

    const input = screen.getByLabelText(/amount to stake/i);
    fireEvent.change(input, { target: { value: '100' } });

    expect(input.value).toBe('100');
  });

  it('sets max amount when MAX button is clicked', () => {
    render(
      <StakeForm balance={1000} onStake={mockOnStake} isLoading={false} />
    );

    const maxButton = screen.getByText(/MAX/i);
    fireEvent.click(maxButton);

    const input = screen.getByLabelText(/amount to stake/i);
    expect(input.value).toBe('1000');
  });

  it('shows error when amount exceeds balance', () => {
    render(
      <StakeForm balance={1000} onStake={mockOnStake} isLoading={false} />
    );

    const input = screen.getByLabelText(/amount to stake/i);
    fireEvent.change(input, { target: { value: '1500' } });

    expect(screen.getByText(/amount exceeds available balance/i)).toBeInTheDocument();
  });

  it('shows error when amount is zero or negative', () => {
    render(
      <StakeForm balance={1000} onStake={mockOnStake} isLoading={false} />
    );

    const input = screen.getByLabelText(/amount to stake/i);
    fireEvent.change(input, { target: { value: '0' } });

    expect(screen.getByText(/amount must be greater than 0/i)).toBeInTheDocument();
  });

  it('calls onStake with correct amount when form is submitted', async () => {
    render(
      <StakeForm balance={1000} onStake={mockOnStake} isLoading={false} />
    );

    const input = screen.getByLabelText(/amount to stake/i);
    fireEvent.change(input, { target: { value: '100' } });

    const submitButton = screen.getByRole('button', { name: /stake tokens/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnStake).toHaveBeenCalledWith(100);
    });
  });

  it('disables form when loading', () => {
    render(
      <StakeForm balance={1000} onStake={mockOnStake} isLoading={true} />
    );

    const input = screen.getByLabelText(/amount to stake/i);
    const maxButton = screen.getByText(/MAX/i);
    const submitButton = screen.getByRole('button', { name: /staking/i });

    expect(input).toBeDisabled();
    expect(maxButton).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it('disables form when wallet is not connected', () => {
    useWallet.mockReturnValue({
      publicKey: null,
    });

    render(
      <StakeForm balance={1000} onStake={mockOnStake} isLoading={false} />
    );

    const input = screen.getByLabelText(/amount to stake/i);
    const submitButton = screen.getByRole('button', { name: /stake tokens/i });

    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it('clears input after successful stake', async () => {
    mockOnStake.mockResolvedValue();

    render(
      <StakeForm balance={1000} onStake={mockOnStake} isLoading={false} />
    );

    const input = screen.getByLabelText(/amount to stake/i);
    fireEvent.change(input, { target: { value: '100' } });

    const submitButton = screen.getByRole('button', { name: /stake tokens/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('shows error message when stake fails', async () => {
    mockOnStake.mockRejectedValue(new Error('Transaction failed'));

    render(
      <StakeForm balance={1000} onStake={mockOnStake} isLoading={false} />
    );

    const input = screen.getByLabelText(/amount to stake/i);
    fireEvent.change(input, { target: { value: '100' } });

    const submitButton = screen.getByRole('button', { name: /stake tokens/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/transaction failed/i)).toBeInTheDocument();
    });
  });

  it('prevents submission with invalid amount', () => {
    render(
      <StakeForm balance={1000} onStake={mockOnStake} isLoading={false} />
    );

    const submitButton = screen.getByRole('button', { name: /stake tokens/i });
    fireEvent.click(submitButton);

    expect(mockOnStake).not.toHaveBeenCalled();
  });
});
