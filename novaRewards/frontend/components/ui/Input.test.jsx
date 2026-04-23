import React from 'react';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';
import '@testing-library/jest-dom';

describe('Input component', () => {
  it('renders correctly', () => {
    render(<Input placeholder="Enter text" />);
    const input = screen.getByPlaceholderText(/enter text/i);
    expect(input).toBeInTheDocument();
  });

  it('displays an error message when error prop is passed', () => {
    render(<Input error="This field is required" />);
    const errorMessage = screen.getByText(/this field is required/i);
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveClass('text-red-500');
  });

  it('is disabled when disabled prop is passed', () => {
    render(<Input disabled placeholder="Disabled" />);
    const input = screen.getByPlaceholderText(/disabled/i);
    expect(input).toBeDisabled();
  });
});
