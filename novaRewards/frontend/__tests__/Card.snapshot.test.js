/**
 * Snapshot tests for Card — Issue #958
 *
 * Covers Card, CardHeader, CardTitle, CardContent, CardFooter,
 * and common composed layouts.
 *
 * Updating snapshots: see Button.snapshot.test.js for policy.
 */
import React from 'react';
import { render } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '../../components/ui/Card';

describe('Card snapshots', () => {
  it('renders bare Card', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders Card with custom className', () => {
    const { container } = render(<Card className="p-4 bg-gray-50">Content</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders CardHeader', () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders CardTitle', () => {
    const { container } = render(<CardTitle>My Title</CardTitle>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders CardContent', () => {
    const { container } = render(<CardContent>Body text</CardContent>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders CardFooter', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders fully composed Card', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Campaign Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Total rewards issued: 1,200 NOVA</p>
        </CardContent>
        <CardFooter>
          <button>View details</button>
        </CardFooter>
      </Card>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
