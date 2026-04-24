import React from 'react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/Alert';

async function expectNoViolations(ui) {
  const { container } = render(ui);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

// ── Button ────────────────────────────────────────────────────────────────────
describe('Button — axe', () => {
  test('primary has no violations', async () => {
    await expectNoViolations(<Button>Save</Button>);
  });

  test('disabled has no violations', async () => {
    await expectNoViolations(<Button disabled>Save</Button>);
  });

  test('loading has no violations', async () => {
    await expectNoViolations(<Button loading>Saving…</Button>);
  });

  test('danger has no violations', async () => {
    await expectNoViolations(<Button variant="danger">Delete</Button>);
  });
});

// ── Input ─────────────────────────────────────────────────────────────────────
describe('Input — axe', () => {
  test('with label has no violations', async () => {
    await expectNoViolations(<Input label="Email" type="email" />);
  });

  test('with error has no violations', async () => {
    await expectNoViolations(
      <Input label="Email" type="email" error="Invalid email address" />
    );
  });

  test('disabled has no violations', async () => {
    await expectNoViolations(<Input label="Email" type="email" disabled />);
  });

  test('with aria-label (no visible label) has no violations', async () => {
    await expectNoViolations(<Input aria-label="Search" type="search" />);
  });
});

// ── Badge ─────────────────────────────────────────────────────────────────────
describe('Badge — axe', () => {
  test('info has no violations', async () => {
    await expectNoViolations(<Badge variant="info">Info</Badge>);
  });

  test('success has no violations', async () => {
    await expectNoViolations(<Badge variant="success">Success</Badge>);
  });

  test('error has no violations', async () => {
    await expectNoViolations(<Badge variant="error">Error</Badge>);
  });
});

// ── Card ──────────────────────────────────────────────────────────────────────
describe('Card — axe', () => {
  test('default card has no violations', async () => {
    await expectNoViolations(
      <Card>
        <h3>Card Title</h3>
        <p>Card content.</p>
      </Card>
    );
  });
});

// ── Select ────────────────────────────────────────────────────────────────────
describe('Select — axe', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ];

  test('with label has no violations', async () => {
    await expectNoViolations(<Select label="Category" options={options} />);
  });

  test('with error has no violations', async () => {
    await expectNoViolations(
      <Select label="Category" options={options} error="Selection required." />
    );
  });

  test('disabled has no violations', async () => {
    await expectNoViolations(<Select label="Category" options={options} disabled />);
  });
});

// ── Alert ─────────────────────────────────────────────────────────────────────
describe('Alert — axe', () => {
  test('default has no violations', async () => {
    await expectNoViolations(
      <Alert variant="default">
        <AlertTitle>Info</AlertTitle>
        <AlertDescription>Something to note.</AlertDescription>
      </Alert>
    );
  });

  test('destructive has no violations', async () => {
    await expectNoViolations(
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something went wrong.</AlertDescription>
      </Alert>
    );
  });

  test('success has no violations', async () => {
    await expectNoViolations(
      <Alert variant="success">
        <AlertTitle>Done</AlertTitle>
        <AlertDescription>Changes saved.</AlertDescription>
      </Alert>
    );
  });
});

// ── Composite form ────────────────────────────────────────────────────────────
describe('Form with labelled inputs — axe', () => {
  test('login form has no violations', async () => {
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
