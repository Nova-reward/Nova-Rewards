import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card body</Card>);
    expect(screen.getByText('Card body')).toBeInTheDocument();
  });

  it('applies base classes', () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('rounded-xl', 'shadow-sm');
  });

  it('merges custom className', () => {
    render(<Card data-testid="card" className="extra">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('extra');
  });

  it('renders CardHeader, CardTitle, CardContent, CardFooter', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Card>
        <CardHeader><CardTitle>A11y Card</CardTitle></CardHeader>
        <CardContent>Content</CardContent>
      </Card>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
