import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders network error correctly', () => {
    const onRetry = jest.fn();
    render(
      <ErrorState
        type="network"
        onRetry={onRetry}
      />
    );
    
    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText(/Unable to connect to the server/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
  });

  it('renders server error with status code', () => {
    render(
      <ErrorState
        type="server"
        statusCode={500}
        onRetry={() => {}}
      />
    );
    
    expect(screen.getByText('Server Error')).toBeInTheDocument();
    expect(screen.getByText(/Server error 500/i)).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = jest.fn();
    render(
      <ErrorState
        type="network"
        onRetry={onRetry}
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show retry button when showRetry is false', () => {
    render(
      <ErrorState
        type="network"
        onRetry={() => {}}
        showRetry={false}
      />
    );
    
    expect(screen.queryByRole('button', { name: /Try Again/i })).not.toBeInTheDocument();
  });
});
