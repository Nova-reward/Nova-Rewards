import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Input } from './Input';

describe('Input', () => {
  it('renders input element', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText(/enter text/i)).toBeInTheDocument();
  });

  it('renders label and associates it with input', () => {
    render(<Input id="email" label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows error message with role="alert"', () => {
    render(<Input error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('sets aria-invalid when error is present', () => {
    render(<Input error="Bad value" placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toHaveAttribute('aria-invalid', 'true');
  });

  it('applies error border class when error is present', () => {
    render(<Input error="Oops" placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toHaveClass('border-red-500');
  });

  it('is disabled when disabled prop is passed', () => {
    render(<Input disabled placeholder="Disabled" />);
    expect(screen.getByPlaceholderText('Disabled')).toBeDisabled();
  });

  it('accepts typed input', async () => {
    const user = userEvent.setup();
    render(<Input placeholder="Type here" />);
    const input = screen.getByPlaceholderText('Type here');
    await user.type(input, 'hello');
    expect(input).toHaveValue('hello');
  });

  it('clears value on clear', async () => {
    const user = userEvent.setup();
    render(<Input placeholder="Type here" />);
    const input = screen.getByPlaceholderText('Type here');
    await user.type(input, 'hello');
    await user.clear(input);
    expect(input).toHaveValue('');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Input id="a11y" label="Name" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
