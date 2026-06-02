import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies default variant class', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toHaveClass('bg-primary-600');
  });

  it('applies destructive variant class', () => {
    render(<Badge variant="destructive">Error</Badge>);
    expect(screen.getByText('Error')).toHaveClass('bg-error-500');
  });

  it('applies secondary variant class', () => {
    render(<Badge variant="secondary">Info</Badge>);
    expect(screen.getByText('Info')).toHaveClass('bg-neutral-100');
  });

  it('applies outline variant class', () => {
    render(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText('Outline')).toHaveClass('border-neutral-300');
  });

  it('merges custom className', () => {
    render(<Badge className="custom-class">Tag</Badge>);
    expect(screen.getByText('Tag')).toHaveClass('custom-class');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Badge>Accessible</Badge>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
