import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Select from './Select';

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

describe('Select', () => {
  it('renders all options', () => {
    render(<Select options={OPTIONS} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('renders label and associates it with the select', () => {
    render(<Select id="fruit" label="Fruit" options={OPTIONS} />);
    expect(screen.getByLabelText('Fruit')).toBeInTheDocument();
  });

  it('shows error message and sets aria-invalid', () => {
    render(<Select options={OPTIONS} label="Pick" id="pick" error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows helper text when no error', () => {
    render(<Select options={OPTIONS} helperText="Choose one" />);
    expect(screen.getByText('Choose one')).toBeInTheDocument();
  });

  it('does not show helper text when error is present', () => {
    render(<Select options={OPTIONS} error="Oops" helperText="Choose one" />);
    expect(screen.queryByText('Choose one')).not.toBeInTheDocument();
  });

  it('allows selecting a different option', async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} label="Pick" id="pick" />);
    await user.selectOptions(screen.getByRole('combobox'), 'b');
    expect(screen.getByRole('combobox')).toHaveValue('b');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Select id="a11y" label="Choose" options={OPTIONS} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
