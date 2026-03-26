import { render, screen } from '@testing-library/react';
import TransactionLink from '../components/TransactionLink';

describe('TransactionLink', () => {
  const mockTxHash = 'abc123def456789';

  test('renders link with correct URL and attributes', () => {
    render(<TransactionLink txHash={mockTxHash} />);
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `https://stellar.expert/explorer/testnet/tx/${mockTxHash}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('aria-label', `View transaction ${mockTxHash} on Stellar Expert`);
    expect(link).toHaveTextContent(mockTxHash);
  });

  test('returns null when txHash is undefined', () => {
    const { container } = render(<TransactionLink />);
    expect(container.firstChild).toBeNull();
  });

  test('uses mainnet when specified', () => {
    render(<TransactionLink txHash={mockTxHash} network="mainnet" />);
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `https://stellar.expert/explorer/mainnet/tx/${mockTxHash}`);
  });

  test('defaults to testnet when network not specified', () => {
    render(<TransactionLink txHash={mockTxHash} />);
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `https://stellar.expert/explorer/testnet/tx/${mockTxHash}`);
  });
});
