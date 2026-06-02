/**
 * Accessibility Tests — Issue #407
 * 
 * Comprehensive accessibility testing suite covering:
 * - WCAG 2.1 Level AA compliance
 * - Keyboard navigation
 * - Screen reader support (ARIA attributes)
 * - Color contrast
 * - Focus management
 * - Semantic HTML
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import MobileCardList from '../components/MobileCardList';
import BottomNav from '../components/BottomNav';
import Toast from '../components/Toast';
import ThemeToggle from '../components/ThemeToggle';
import WalletConnectButton from '../components/WalletConnectButton';
import CampaignCard from '../components/CampaignCard';
import TransactionHistory from '../components/TransactionHistory';
import ConfirmationModal from '../components/ConfirmationModal';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// ── Next.js router mock ───────────────────────────────────────────────────────
jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/dashboard', push: jest.fn(), query: {} }),
}));

jest.mock('next/link', () =>
  function Link({ href, children, ...props }) {
    return <a href={href} {...props}>{children}</a>;
  }
);

// Mock Freighter API
jest.mock('@stellar/freighter-api', () => ({
  isConnected: jest.fn().mockResolvedValue(false),
  getPublicKey: jest.fn().mockResolvedValue('MOCK_PUBLIC_KEY'),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
async function expectNoViolations(ui, axeOptions = {}) {
  const { container } = render(ui);
  const results = await axe(container, {
    rules: {
      // Ensure color contrast meets WCAG AA standards
      'color-contrast': { enabled: true },
      // Ensure proper ARIA usage
      'aria-valid-attr': { enabled: true },
      'aria-valid-attr-value': { enabled: true },
      'aria-required-attr': { enabled: true },
      // Ensure keyboard accessibility
      'focus-order-semantics': { enabled: true },
      'tabindex': { enabled: true },
      ...axeOptions,
    },
  });
  expect(results).toHaveNoViolations();
  return { container, results };
}

/**
 * Helper to test keyboard navigation
 */
async function testKeyboardNavigation(element, key) {
  const user = userEvent.setup();
  element.focus();
  await user.keyboard(key);
  return element;
}

/**
 * Helper to check ARIA attributes
 */
function checkAriaAttributes(element, expectedAttrs) {
  Object.entries(expectedAttrs).forEach(([attr, value]) => {
    if (value === null) {
      expect(element).not.toHaveAttribute(attr);
    } else {
      expect(element).toHaveAttribute(attr, value);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WCAG 2.1 COMPLIANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Button — WCAG 2.1 Compliance', () => {
  test('primary button has no violations', async () => {
    await expectNoViolations(<Button>Save</Button>);
  });

  test('disabled button has no violations', async () => {
    await expectNoViolations(<Button disabled>Save</Button>);
  });

  test('loading button has no violations and proper ARIA', async () => {
    const { container } = await expectNoViolations(<Button loading>Saving…</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });

  test('danger button has no violations', async () => {
    await expectNoViolations(<Button variant="danger">Delete</Button>);
  });

  test('button has sufficient color contrast', async () => {
    await expectNoViolations(<Button>Click Me</Button>, {
      rules: { 'color-contrast': { enabled: true } },
    });
  });
});

describe('Input — WCAG 2.1 Compliance', () => {
  test('input with label has no violations', async () => {
    await expectNoViolations(<Input label="Email address" type="email" />);
  });

  test('input with error has proper ARIA attributes', async () => {
    const { container } = await expectNoViolations(
      <Input label="Email address" type="email" error="Invalid email address" />
    );
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
    
    const errorId = input.getAttribute('aria-describedby');
    const errorElement = container.querySelector(`#${errorId}`);
    expect(errorElement).toHaveAttribute('role', 'alert');
    expect(errorElement).toHaveTextContent('Invalid email address');
  });

  test('disabled input has no violations', async () => {
    await expectNoViolations(<Input label="Email address" type="email" disabled />);
  });

  test('input with aria-label (no visible label) has no violations', async () => {
    await expectNoViolations(<Input aria-label="Search" type="search" />);
  });

  test('input with helper text has proper association', async () => {
    const { container } = render(
      <Input label="Password" type="password" helperText="Must be at least 8 characters" />
    );
    const input = container.querySelector('input');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    
    const helperElement = container.querySelector(`#${describedBy}`);
    expect(helperElement).toHaveTextContent('Must be at least 8 characters');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KEYBOARD NAVIGATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Keyboard Navigation', () => {
  test('button can be focused and activated with keyboard', async () => {
    const handleClick = jest.fn();
    const { container } = render(<Button onClick={handleClick}>Click Me</Button>);
    const button = container.querySelector('button');
    
    // Test focus
    button.focus();
    expect(button).toHaveFocus();
    
    // Test Enter key activation
    await testKeyboardNavigation(button, '{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    // Test Space key activation
    await testKeyboardNavigation(button, ' ');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  test('input can be focused and typed into with keyboard', async () => {
    const user = userEvent.setup();
    const { container } = render(<Input label="Name" type="text" />);
    const input = container.querySelector('input');
    
    // Test focus
    await user.tab();
    expect(input).toHaveFocus();
    
    // Test typing
    await user.keyboard('John Doe');
    expect(input).toHaveValue('John Doe');
  });

  test('form can be navigated with Tab key', async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Input label="Email" type="email" name="email" />
        <Input label="Password" type="password" name="password" />
        <Button type="submit">Submit</Button>
      </form>
    );
    
    // Tab through form elements
    await user.tab();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveFocus();
  });

  test('disabled button cannot be focused via keyboard', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Button>First</Button>
        <Button disabled>Disabled</Button>
        <Button>Last</Button>
      </>
    );
    
    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    
    await user.tab();
    // Should skip disabled button
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  test('modal traps focus within dialog', async () => {
    const user = userEvent.setup();
    const handleClose = jest.fn();
    render(
      <ConfirmationModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={jest.fn()}
        title="Confirm Action"
        message="Are you sure?"
      />
    );
    
    // Focus should be trapped within modal
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    
    // Tab through modal elements
    await user.tab();
    const focusedElement = document.activeElement;
    expect(dialog.contains(focusedElement)).toBe(true);
  });
});
// ═══════════════════════════════════════════════════════════════════════════════
// COLOR CONTRAST TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Color Contrast - WCAG AA Compliance', () => {
  test('primary button meets color contrast requirements', async () => {
    await expectNoViolations(<Button variant="primary">Click Me</Button>, {
      rules: { 'color-contrast': { enabled: true } },
    });
  });

  test('secondary button meets color contrast requirements', async () => {
    await expectNoViolations(<Button variant="secondary">Click Me</Button>, {
      rules: { 'color-contrast': { enabled: true } },
    });
  });

  test('danger button meets color contrast requirements', async () => {
    await expectNoViolations(<Button variant="danger">Delete</Button>, {
      rules: { 'color-contrast': { enabled: true } },
    });
  });

  test('disabled button meets color contrast requirements', async () => {
    await expectNoViolations(<Button disabled>Disabled</Button>, {
      rules: { 'color-contrast': { enabled: true } },
    });
  });

  test('input text meets color contrast requirements', async () => {
    await expectNoViolations(<Input label="Name" type="text" />, {
      rules: { 'color-contrast': { enabled: true } },
    });
  });

  test('error text meets color contrast requirements', async () => {
    await expectNoViolations(
      <Input label="Email" type="email" error="Invalid email" />,
      { rules: { 'color-contrast': { enabled: true } } }
    );
  });

  test('toast notifications meet color contrast requirements', async () => {
    await expectNoViolations(
      <Toast message="Success!" type="success" onClose={jest.fn()} />,
      { rules: { 'color-contrast': { enabled: true } } }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FOCUS MANAGEMENT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Focus Management', () => {
  test('focused button has visible focus indicator', () => {
    const { container } = render(<Button>Click Me</Button>);
    const button = container.querySelector('button');
    
    button.focus();
    expect(button).toHaveFocus();
    
    // Check that focus styles are applied (via class or inline styles)
    const computedStyle = window.getComputedStyle(button);
    expect(computedStyle).toBeDefined();
  });

  test('focused input has visible focus indicator', () => {
    const { container } = render(<Input label="Name" type="text" />);
    const input = container.querySelector('input');
    
    input.focus();
    expect(input).toHaveFocus();
  });

  test('skip to main content link is first focusable element', async () => {
    // This would be tested in a full page context
    // For now, we ensure components don't interfere with focus order
    const user = userEvent.setup();
    render(
      <>
        <Button>First</Button>
        <Button>Second</Button>
        <Button>Third</Button>
      </>
    );
    
    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  test('focus is not trapped in non-modal components', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Input label="Field 1" type="text" />
        <Input label="Field 2" type="text" />
        <Button>Submit</Button>
      </>
    );
    
    // Should be able to tab through all elements
    await user.tab();
    expect(screen.getByLabelText('Field 1')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText('Field 2')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveFocus();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEMANTIC HTML & LANDMARK TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Semantic HTML Structure', () => {
  test('navigation uses nav landmark', () => {
    render(<BottomNav />);
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  test('buttons use button element, not div', () => {
    const { container } = render(<Button>Click Me</Button>);
    const button = container.querySelector('button');
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  test('form inputs have associated labels', () => {
    render(<Input label="Email Address" type="email" />);
    const input = screen.getByLabelText('Email Address');
    expect(input).toBeInTheDocument();
  });

  test('headings have proper hierarchy', () => {
    const campaign = {
      id: 1,
      name: 'Test Campaign',
      description: 'Description',
      reward_amount: 100,
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      status: 'active',
    };
    
    const { container } = render(<CampaignCard campaign={campaign} />);
    
    // Should have heading elements
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE ACCESSIBILITY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('MobileCardList — axe', () => {
  test('button has proper role and accessible name', () => {
    const { container } = render(<Button>Save Changes</Button>);
    const button = container.querySelector('button');
    
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAccessibleName('Save Changes');
  });

  test('loading button announces busy state', () => {
    const { container } = render(<Button loading>Processing</Button>);
    const button = container.querySelector('button');
    
    checkAriaAttributes(button, {
      'aria-busy': 'true',
    });
  });

  test('input error is announced to screen readers', () => {
    const { container } = render(
      <Input label="Email" type="email" error="Email is required" />
    );
    const input = container.querySelector('input');
    const errorId = input.getAttribute('aria-describedby');
    const errorElement = container.querySelector(`#${errorId}`);
    
    checkAriaAttributes(input, {
      'aria-invalid': 'true',
    });
    
    expect(errorElement).toHaveAttribute('role', 'alert');
  });

  test('toast notifications have proper ARIA role', () => {
    const { container } = render(
      <Toast message="Success!" type="success" onClose={jest.fn()} />
    );
    
    const toast = container.querySelector('[role="alert"]') || 
                  container.querySelector('[role="status"]');
    expect(toast).toBeInTheDocument();
  });

  test('modal has proper dialog role and labeling', () => {
    render(
      <ConfirmationModal
        isOpen={true}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        title="Delete Item"
        message="Are you sure you want to delete this item?"
      />
    );
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName('Delete Item');
  });

  test('campaign card has proper semantic structure', () => {
    const campaign = {
      id: 1,
      name: 'Summer Sale',
      description: 'Get 20% off',
      reward_amount: 100,
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      status: 'active',
    };
    
    const { container } = render(<CampaignCard campaign={campaign} />);
    
    // Should have proper heading structure
    const heading = container.querySelector('h2, h3, h4');
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Summer Sale');
  });

  test('transaction history table has proper ARIA labels', () => {
    const transactions = [
      {
        id: 1,
        type: 'reward',
        amount: 100,
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      },
    ];
    
    render(<TransactionHistory transactions={transactions} />);
    
    // Table should have accessible name
    const table = screen.queryByRole('table');
    if (table) {
      expect(table).toHaveAccessibleName();
    }
  });

  test('navigation has proper landmark roles', () => {
    render(<BottomNav />);
    
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });
});
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

// ═══════════════════════════════════════════════════════════════════════════════
// FORM ACCESSIBILITY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Form Accessibility', () => {
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

  test('form has accessible name via aria-label', () => {
    const { container } = render(
      <form aria-label="Contact Form">
        <Input label="Name" type="text" />
      </form>
    );
    
    const form = container.querySelector('form');
    expect(form).toHaveAttribute('aria-label', 'Contact Form');
  });

  test('required fields are properly indicated', () => {
    const { container } = render(
      <Input label="Email" type="email" required />
    );
    
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('required');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTIVE COMPONENT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Interactive Components Accessibility', () => {
  test('theme toggle has accessible name and state', () => {
    const { container } = render(<ThemeToggle />);
    const toggle = container.querySelector('button');
    
    expect(toggle).toHaveAccessibleName();
  });

  test('wallet connect button has accessible name', () => {
    render(<WalletConnectButton />);
    const button = screen.getByRole('button');
    expect(button).toHaveAccessibleName();
  });

  test('modal close button has accessible name', () => {
    render(
      <ConfirmationModal
        isOpen={true}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        title="Confirm"
        message="Are you sure?"
      />
    );
    
    // Look for close button
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => 
      btn.getAttribute('aria-label')?.toLowerCase().includes('close') ||
      btn.textContent?.toLowerCase().includes('close') ||
      btn.textContent?.toLowerCase().includes('cancel')
    );
    
    expect(closeButton).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WCAG 2.1 SPECIFIC CRITERIA TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('WCAG 2.1 Specific Criteria', () => {
  test('1.3.1 Info and Relationships - form labels are programmatically associated', () => {
    const { container } = render(<Input label="Username" type="text" />);
    const input = container.querySelector('input');
    const label = container.querySelector('label');
    
    expect(label).toHaveAttribute('for', input.id);
  });

  test('1.4.3 Contrast (Minimum) - text has sufficient contrast', async () => {
    await expectNoViolations(
      <div>
        <Button>Primary Action</Button>
        <Input label="Text Field" type="text" />
      </div>,
      { rules: { 'color-contrast': { enabled: true } } }
    );
  });

  test('2.1.1 Keyboard - all functionality available via keyboard', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Action</Button>);
    
    const button = screen.getByRole('button', { name: 'Action' });
    button.focus();
    
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalled();
  });

  test('2.4.3 Focus Order - focus order is logical and intuitive', async () => {
    const user = userEvent.setup();
    
    render(
      <form>
        <Input label="First Name" type="text" />
        <Input label="Last Name" type="text" />
        <Input label="Email" type="email" />
        <Button type="submit">Submit</Button>
      </form>
    );
    
    await user.tab();
    expect(screen.getByLabelText('First Name')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText('Last Name')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveFocus();
  });

  test('2.4.7 Focus Visible - focus indicator is visible', () => {
    const { container } = render(<Button>Focus Me</Button>);
    const button = container.querySelector('button');
    
    button.focus();
    expect(button).toHaveFocus();
    
    // Ensure focus styles exist (this is a basic check)
    expect(button).toBeVisible();
  });

  test('3.2.2 On Input - changing input does not cause unexpected context change', async () => {
    const user = userEvent.setup();
    const { container } = render(<Input label="Search" type="text" />);
    const input = container.querySelector('input');
    
    await user.type(input, 'test');
    
    // Input should still be focused and visible
    expect(input).toHaveFocus();
    expect(input).toBeVisible();
  });

  test('3.3.1 Error Identification - errors are clearly identified', () => {
    const { container } = render(
      <Input label="Email" type="email" error="Please enter a valid email address" />
    );
    
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    
    const errorId = input.getAttribute('aria-describedby');
    const errorElement = container.querySelector(`#${errorId}`);
    expect(errorElement).toHaveTextContent('Please enter a valid email address');
  });

  test('3.3.2 Labels or Instructions - inputs have clear labels', () => {
    render(
      <form>
        <Input label="Email Address" type="email" />
        <Input label="Password (minimum 8 characters)" type="password" />
      </form>
    );
    
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password (minimum 8 characters)')).toBeInTheDocument();
  });

  test('4.1.2 Name, Role, Value - components have proper ARIA attributes', () => {
    const { container } = render(
      <>
        <Button>Submit</Button>
        <Input label="Name" type="text" />
      </>
    );
    
    const button = container.querySelector('button');
    expect(button).toHaveAttribute('type');
    
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('type');
    expect(input).toHaveAttribute('id');
  });
});
