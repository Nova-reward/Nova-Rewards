import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RewardCard from '../components/RewardCard';

const baseReward = {
  id: 1,
  name: 'Coffee Voucher',
  description: 'Free coffee',
  cost: 100,
  stock: 5,
  image_url: null,
};

describe('RewardCard', () => {
  test('renders reward name and cost', () => {
    render(<RewardCard reward={baseReward} userPoints={200} onRedeem={jest.fn()} />);
    expect(screen.getByText('Coffee Voucher')).toBeInTheDocument();
    expect(screen.getByText('100 pts')).toBeInTheDocument();
  });

  test('renders description when provided', () => {
    render(<RewardCard reward={baseReward} userPoints={200} onRedeem={jest.fn()} />);
    expect(screen.getByText('Free coffee')).toBeInTheDocument();
  });

  test('shows image when image_url is provided', () => {
    const reward = { ...baseReward, image_url: 'https://example.com/img.png' };
    render(<RewardCard reward={reward} userPoints={200} onRedeem={jest.fn()} />);
    expect(screen.getByRole('img', { name: 'Coffee Voucher' })).toHaveAttribute('src', 'https://example.com/img.png');
  });

  test('shows placeholder when no image_url', () => {
    render(<RewardCard reward={baseReward} userPoints={200} onRedeem={jest.fn()} />);
    expect(screen.getByText('No Image')).toBeInTheDocument();
  });

  test('redeem button is enabled when user can afford and item is in stock', () => {
    render(<RewardCard reward={baseReward} userPoints={200} onRedeem={jest.fn()} />);
    expect(screen.getByRole('button', { name: /redeem coffee voucher/i })).not.toBeDisabled();
  });

  test('redeem button is disabled when user cannot afford', () => {
    render(<RewardCard reward={baseReward} userPoints={50} onRedeem={jest.fn()} />);
    expect(screen.getByRole('button', { name: /redeem coffee voucher/i })).toBeDisabled();
  });

  test('shows points deficit message when user cannot afford', () => {
    render(<RewardCard reward={baseReward} userPoints={50} onRedeem={jest.fn()} />);
    expect(screen.getByText('You need 50 more points')).toBeInTheDocument();
  });

  test('shows out-of-stock badge and disables button when stock is 0', () => {
    const reward = { ...baseReward, stock: 0 };
    render(<RewardCard reward={reward} userPoints={200} onRedeem={jest.fn()} />);
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /redeem coffee voucher/i })).toBeDisabled();
  });

  test('shows Processing... and disables button when isLoading', () => {
    render(<RewardCard reward={baseReward} userPoints={200} onRedeem={jest.fn()} isLoading />);
    const btn = screen.getByRole('button', { name: /redeem coffee voucher/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Processing...');
  });

  test('calls onRedeem with reward when button clicked', () => {
    const onRedeem = jest.fn();
    render(<RewardCard reward={baseReward} userPoints={200} onRedeem={onRedeem} />);
    fireEvent.click(screen.getByRole('button', { name: /redeem coffee voucher/i }));
    expect(onRedeem).toHaveBeenCalledWith(baseReward);
  });

  test('aria-label on redeem button includes reward name', () => {
    render(<RewardCard reward={baseReward} userPoints={200} onRedeem={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Redeem Coffee Voucher' })).toBeInTheDocument();
  });
});
