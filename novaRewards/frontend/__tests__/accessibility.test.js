import React from 'react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import MobileCardList from '../components/MobileCardList';
import BottomNav from '../components/BottomNav';

// ── Next.js router mock ───────────────────────────────────────────────────────
jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/dashboard' }),
}));

jest.mock('next/link', () =>
  function Link({ href, children, ...props }) {
    return <a href={href} {...props}>{children}</a>;
  }
);

// ── Helpers ───────────────────────────────────────────────────────────────────
async function expectNoViolations(ui) {
  const { container } = render(ui);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

// ── Button ────────────────────────────────────────────────────────────────────
describe('Button — axe', () => {
  test('primary button has no violations', async () => {
    await expectNoViolations(<Button>Save</Button>);
  });

  test('disabled button has no violations', async () => {
    await expectNoViolations(<Button disabled>Save</Button>);
  });

  test('danger button has no violations', async () => {
    await expectNoViolations(<Button variant="danger">Delete</Button>);
  });
});

// ── Input ─────────────────────────────────────────────────────────────────────
describe('Input — axe', () => {
  test('input with label has no violations', async () => {
    await expectNoViolations(<Input label="Email address" type="email" />);
  });

  test('input with error has no violations', async () => {
    await expectNoViolations(
      <Input label="Email address" type="email" error="Invalid email address" />
    );
  });

  test('input with aria-label (no visible label) has no violations', async () => {
    await expectNoViolations(<Input aria-label="Search" type="search" />);
  });
});

// ── MobileCardList ────────────────────────────────────────────────────────────
describe('MobileCardList — axe', () => {
  const columns = [
    { key: 'name',   label: 'Name'   },
    { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' },
  ];

  const data = [
    { id: 1, name: 'Alice',   amount: '100', status: 'confirmed' },
    { id: 2, name: 'Bob',     amount: '50',  status: 'pending'   },
  ];

  test('card list (mobile view) has no violations', async () => {
    // Render the ul (card list) portion — simulate mobile by checking the ul
    await expectNoViolations(
      <MobileCardList columns={columns} data={data} />
    );
  });

  test('empty state has no violations', async () => {
    await expectNoViolations(
      <MobileCardList columns={columns} data={[]} emptyMessage="No records found." />
    );
  });
});

// ── BottomNav ─────────────────────────────────────────────────────────────────
describe('BottomNav — axe', () => {
  test('bottom navigation has no violations', async () => {
    await expectNoViolations(<BottomNav />);
  });
});

// ── Form landmark ─────────────────────────────────────────────────────────────
describe('Form with labelled inputs — axe', () => {
  test('login form structure has no violations', async () => {
    await expectNoViolations(
      <form aria-label="Sign in">
        <Input label="Email" type="email" name="email" />
        <Input label="Password" type="password" name="password" />
        <Button type="submit">Sign in</Button>
      </form>
    );
  });

  test('form with validation errors has no violations', async () => {
    await expectNoViolations(
      <form aria-label="Sign in">
        <Input label="Email" type="email" error="Email is required" />
        <Input label="Password" type="password" error="Password is required" />
        <Button type="submit">Sign in</Button>
      </form>
    );
  });
});
