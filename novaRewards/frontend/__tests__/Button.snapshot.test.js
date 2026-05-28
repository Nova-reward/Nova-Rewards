/**
 * Snapshot tests for Button — Issue #958
 *
 * Covers all documented variants (primary, secondary, outline, danger)
 * and sizes (sm, md, lg), plus disabled and custom className states.
 *
 * Updating snapshots:
 *   - Run `jest --updateSnapshot` (or `jest -u`) ONLY when an intentional
 *     visual change has been made to the component.
 *   - Never update snapshots to silence a failing test caused by an
 *     unintended regression — fix the component instead.
 *   - Commit updated snapshot files alongside the component change.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { Button } from '../../components/ui/Button';

describe('Button snapshots', () => {
  // Variants
  it('renders primary variant', () => {
    const { container } = render(<Button variant="primary">Save</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders secondary variant', () => {
    const { container } = render(<Button variant="secondary">Cancel</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders outline variant', () => {
    const { container } = render(<Button variant="outline">View</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders danger variant', () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  // Sizes
  it('renders sm size', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders md size (default)', () => {
    const { container } = render(<Button size="md">Medium</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders lg size', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  // States
  it('renders disabled state', () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with custom className', () => {
    const { container } = render(<Button className="w-full">Full width</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders default (no props)', () => {
    const { container } = render(<Button>Default</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });
});
