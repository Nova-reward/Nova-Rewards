import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Alert, AlertTitle, AlertDescription } from './Alert';

describe('Alert', () => {
  it('renders with role="alert"', () => {
    render(<Alert>Something happened</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Alert>Watch out!</Alert>);
    expect(screen.getByText('Watch out!')).toBeInTheDocument();
  });

  it('applies default variant class', () => {
    render(<Alert data-testid="alert">Default</Alert>);
    expect(screen.getByTestId('alert')).toHaveClass('bg-white');
  });

  it('applies destructive variant class', () => {
    render(<Alert variant="destructive" data-testid="alert">Error</Alert>);
    expect(screen.getByTestId('alert')).toHaveClass('text-red-500');
  });

  it('applies success variant class', () => {
    render(<Alert variant="success" data-testid="alert">Success</Alert>);
    expect(screen.getByTestId('alert')).toHaveClass('text-green-700');
  });

  it('renders AlertTitle and AlertDescription', () => {
    render(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Something needs your attention.</AlertDescription>
      </Alert>
    );
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Something needs your attention.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Alert>
        <AlertTitle>Notice</AlertTitle>
        <AlertDescription>All good.</AlertDescription>
      </Alert>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
