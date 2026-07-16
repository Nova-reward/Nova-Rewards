import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Recharts mock ──────────────────────────────────────────────────────────────
// Recharts uses ResizeObserver and SVG APIs unavailable in jsdom.
// We render lightweight stubs that expose the props we need to test.
jest.mock('recharts', () => {
  const React = require('react');
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
    LineChart: ({ children, onClick, 'data-testid': dt }) => (
      <div
        data-testid={dt ?? 'line-chart'}
        onClick={() =>
          onClick?.({ activePayload: [{ payload: { date: '2024-01-15', rewards: 42, type: 'issuance' } }] })
        }
      >
        {children}
      </div>
    ),
    Line: ({ dataKey, name, hide }) => (
      <div data-testid={`line-${dataKey}`} data-name={name} data-hidden={String(hide ?? false)} />
    ),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: ({ content }) => (content ? React.cloneElement(content, {
      active: true,
      payload: [{ dataKey: 'rewards', value: 42, color: '#7c3aed', name: 'Rewards', payload: { date: '2024-01-15', rewards: 42, type: 'issuance', _tooltipBg: '#fff', _tooltipBorder: '#ccc', _tooltipColor: '#000' } }],
      label: '2024-01-15',
    }) : null),
    Legend: () => null,
    Brush: () => <div data-testid="brush" />,
  };
});

// ── Theme mock ─────────────────────────────────────────────────────────────────
jest.mock('../../components/analytics/useChartTheme', () => ({
  useChartTheme: () => ({
    text: '#64748b',
    grid: '#e2e8f0',
    tooltip: { bg: '#fff', border: '#cbd5e1', color: '#0f172a' },
    accent: '#7c3aed',
    palette: ['#7c3aed', '#06b6d4', '#10b981'],
  }),
}));

// ── ChartEmptyState mock ───────────────────────────────────────────────────────
jest.mock('../../components/charts/ChartEmptyState', () =>
  function ChartEmptyState({ type, message }) {
    return <div data-testid={`empty-${type}`}>{message}</div>;
  }
);

import RewardsLineChart from '../../components/charts/RewardsLineChart';

// ── Fixtures ───────────────────────────────────────────────────────────────────
const DATA = [
  { date: '2024-01-13', rewards: 10, type: 'issuance' },
  { date: '2024-01-14', rewards: 25, type: 'redemption' },
  { date: '2024-01-15', rewards: 42, type: 'issuance' },
];

// ── RewardsLineChart ───────────────────────────────────────────────────────────
describe('RewardsLineChart', () => {
  describe('empty / loading / error states', () => {
    it('renders loading state', () => {
      render(<RewardsLineChart loading />);
      expect(screen.getByTestId('empty-loading')).toBeInTheDocument();
    });

    it('renders error state with message', () => {
      render(<RewardsLineChart error="Network error" />);
      expect(screen.getByTestId('empty-error')).toHaveTextContent('Network error');
    });

    it('renders empty state when data is empty', () => {
      render(<RewardsLineChart data={[]} />);
      expect(screen.getByTestId('empty-empty')).toBeInTheDocument();
    });
  });

  describe('chart rendering', () => {
    it('renders the chart container with data', () => {
      render(<RewardsLineChart data={DATA} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders the Brush component for zoom', () => {
      render(<RewardsLineChart data={DATA} />);
      expect(screen.getByTestId('brush')).toBeInTheDocument();
    });

    it('renders a Line for each series', () => {
      const series = [
        { key: 'rewards', label: 'Rewards' },
        { key: 'bonus', label: 'Bonus' },
      ];
      render(<RewardsLineChart data={DATA} series={series} />);
      expect(screen.getByTestId('line-rewards')).toBeInTheDocument();
      expect(screen.getByTestId('line-bonus')).toBeInTheDocument();
    });

    it('defaults to a single "rewards" series when none provided', () => {
      render(<RewardsLineChart data={DATA} />);
      expect(screen.getByTestId('line-rewards')).toBeInTheDocument();
    });
  });

  describe('custom tooltip', () => {
    it('renders tooltip with date, amount, and type', () => {
      render(<RewardsLineChart data={DATA} />);
      // Tooltip mock renders the content element with active=true
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByRole('tooltip')).toHaveTextContent('2024-01-15');
      expect(screen.getByRole('tooltip')).toHaveTextContent('42');
      expect(screen.getByRole('tooltip')).toHaveTextContent('issuance');
    });
  });

  describe('click-to-filter', () => {
    it('calls onDateClick with the clicked date', () => {
      const onDateClick = jest.fn();
      render(<RewardsLineChart data={DATA} onDateClick={onDateClick} />);
      fireEvent.click(screen.getByTestId('line-chart'));
      expect(onDateClick).toHaveBeenCalledWith('2024-01-15');
    });

    it('does not call onDateClick when prop is not provided', () => {
      // Should not throw
      render(<RewardsLineChart data={DATA} />);
      fireEvent.click(screen.getByTestId('line-chart'));
    });
  });

  describe('accessible legend', () => {
    it('renders legend items as checkbox buttons', () => {
      const series = [
        { key: 'rewards', label: 'Rewards' },
        { key: 'bonus', label: 'Bonus' },
      ];
      render(<RewardsLineChart data={DATA} series={series} />);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toHaveAccessibleName('Rewards');
      expect(checkboxes[1]).toHaveAccessibleName('Bonus');
    });

    it('legend items start checked (series visible)', () => {
      render(<RewardsLineChart data={DATA} />);
      expect(screen.getByRole('checkbox', { name: 'Rewards' })).toHaveAttribute('aria-checked', 'true');
    });

    it('toggles series off when legend item is clicked', () => {
      render(<RewardsLineChart data={DATA} />);
      const checkbox = screen.getByRole('checkbox', { name: 'Rewards' });
      fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByTestId('line-rewards')).toHaveAttribute('data-hidden', 'true');
    });

    it('toggles series back on when clicked again', () => {
      render(<RewardsLineChart data={DATA} />);
      const checkbox = screen.getByRole('checkbox', { name: 'Rewards' });
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('line-rewards')).toHaveAttribute('data-hidden', 'false');
    });

    it('toggles series via Enter key', () => {
      render(<RewardsLineChart data={DATA} />);
      const checkbox = screen.getByRole('checkbox', { name: 'Rewards' });
      fireEvent.keyDown(checkbox, { key: 'Enter' });
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('toggles series via Space key', () => {
      render(<RewardsLineChart data={DATA} />);
      const checkbox = screen.getByRole('checkbox', { name: 'Rewards' });
      fireEvent.keyDown(checkbox, { key: ' ' });
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('does not toggle on other keys', () => {
      render(<RewardsLineChart data={DATA} />);
      const checkbox = screen.getByRole('checkbox', { name: 'Rewards' });
      fireEvent.keyDown(checkbox, { key: 'Tab' });
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('independent toggles for multiple series', () => {
      const series = [
        { key: 'rewards', label: 'Rewards' },
        { key: 'bonus', label: 'Bonus' },
      ];
      render(<RewardsLineChart data={DATA} series={series} />);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Rewards' }));
      expect(screen.getByRole('checkbox', { name: 'Rewards' })).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole('checkbox', { name: 'Bonus' })).toHaveAttribute('aria-checked', 'true');
    });
  });
});
