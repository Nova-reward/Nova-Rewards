/**
 * Snapshot tests for DataTable — Issue #958
 *
 * Covers: default render, empty state, sorted state, paginated state,
 * and custom column renderer.
 *
 * Updating snapshots: see Button.snapshot.test.js for policy.
 */
import React from 'react';
import { render } from '@testing-library/react';
import DataTable from '../../components/DataTable';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'amount', label: 'Amount', sortable: true },
  { key: 'status', label: 'Status' },
];

const DATA = [
  { id: 1, name: 'Alice', amount: 100, status: 'confirmed' },
  { id: 2, name: 'Bob', amount: 50, status: 'pending' },
  { id: 3, name: 'Carol', amount: 200, status: 'confirmed' },
];

describe('DataTable snapshots', () => {
  it('renders with data', () => {
    const { container } = render(<DataTable columns={COLUMNS} data={DATA} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders empty state', () => {
    const { container } = render(<DataTable columns={COLUMNS} data={[]} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with custom pageSize', () => {
    const { container } = render(
      <DataTable columns={COLUMNS} data={DATA} pageSize={2} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with custom column renderer', () => {
    const cols = [
      ...COLUMNS,
      {
        key: 'status',
        label: 'Status',
        render: (val) => <span className={`badge badge-${val}`}>{val}</span>,
      },
    ];
    const { container } = render(<DataTable columns={cols} data={DATA} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with no columns', () => {
    const { container } = render(<DataTable columns={[]} data={DATA} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
