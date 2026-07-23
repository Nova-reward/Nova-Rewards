import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import CampaignForm from '../components/CampaignForm';

expect.extend(toHaveNoViolations);

jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/merchant', push: jest.fn(), query: {} }),
}));

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

jest.mock('../components/MultiStepForm', () => {
  const React = require('react');

  return function MockMultiStepForm({ steps, initialData }) {
    const [current, setCurrent] = React.useState(0);
    const [data, setData] = React.useState(initialData);
    const [errors, setErrors] = React.useState({});
    const [liveMessage, setLiveMessage] = React.useState('');

    const step = steps[current];
    const update = (field, value) => {
      setData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    };

    const validate = () => {
      const nextErrors = step.validate ? step.validate(data) : {};
      setErrors(nextErrors);
      setLiveMessage(Object.keys(nextErrors).length > 0 ? 'Please fix the highlighted errors before continuing.' : '');
      return Object.keys(nextErrors).length === 0;
    };

    const handleNext = () => {
      if (!validate()) return;
      setCurrent((prev) => prev + 1);
      setErrors({});
      setLiveMessage('');
    };

    return React.createElement(
      'div',
      null,
      React.createElement('div', { role: 'status', 'aria-live': 'polite' }, liveMessage),
      React.createElement('div', null, step.fields(data, update, errors)),
      React.createElement('button', { type: 'button', onClick: handleNext }, 'Next')
    );
  };
});

async function expectNoViolations(ui) {
  const { container } = render(ui);
  const results = await axe(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });
  expect(results).toHaveNoViolations();
  return { container, results };
}

describe('CampaignForm accessibility', () => {
  test('associates labels and inline error descriptions with form controls', async () => {
    const user = userEvent.setup();
    render(React.createElement(CampaignForm, { merchantId: 'merchant-1', apiKey: 'key-1' }));

    const nameInput = screen.getByLabelText(/campaign name/i);
    expect(nameInput).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText(/campaign name is required/i)).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('aria-describedby', 'name-err');
    expect(screen.getByText(/campaign name is required/i)).toHaveAttribute('id', 'name-err');
  });

  test('announces validation feedback in a polite live region and avoids axe violations', async () => {
    const user = userEvent.setup();
    const { container } = await expectNoViolations(React.createElement(CampaignForm, { merchantId: 'merchant-1', apiKey: 'key-1' }));

    await user.click(screen.getByRole('button', { name: /next/i }));

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent(/please fix/i);
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  test('adds token rows in DOM order and keeps them reachable with the keyboard', async () => {
    const user = userEvent.setup();
    render(React.createElement(CampaignForm, { merchantId: 'merchant-1', apiKey: 'key-1' }));

    await user.click(screen.getByRole('button', { name: /next/i }));

    const addTokenRow = screen.getByRole('button', { name: /add token row/i });
    await user.click(addTokenRow);

    const tokenNameInputs = screen.getAllByLabelText(/token name/i);
    expect(tokenNameInputs).toHaveLength(2);
    expect(tokenNameInputs[0]).toBeInTheDocument();
    expect(tokenNameInputs[1]).toBeInTheDocument();

    await user.tab();
    expect(tokenNameInputs[0]).toHaveFocus();
  });
});
