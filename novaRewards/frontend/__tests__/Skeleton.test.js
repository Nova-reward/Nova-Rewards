import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonRow,
  SkeletonNotification,
  SkeletonDashboard,
  SkeletonGrid,
  SkeletonLeaderboard,
  SkeletonAnalytics,
  SkeletonProfile,
  SkeletonTransactionHistory,
  SkeletonMerchantDashboard,
} from '../components/Skeleton';

describe('SkeletonBlock', () => {
  test('renders a div with animate-pulse class', () => {
    const { container } = render(<SkeletonBlock className="h-4 w-full" />);
    const el = container.firstChild;
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveClass('animate-pulse');
  });

  test('is aria-hidden', () => {
    const { container } = render(<SkeletonBlock />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  test('merges custom className', () => {
    const { container } = render(<SkeletonBlock className="h-10 w-20" />);
    expect(container.firstChild).toHaveClass('h-10', 'w-20');
  });
});

describe('SkeletonCard', () => {
  test('renders image placeholder by default', () => {
    const { container } = render(<SkeletonCard />);
    // image block is h-40
    expect(container.querySelector('.h-40')).toBeInTheDocument();
  });

  test('omits image placeholder when showImage=false', () => {
    const { container } = render(<SkeletonCard showImage={false} />);
    expect(container.querySelector('.h-40')).not.toBeInTheDocument();
  });

  test('is aria-hidden', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('SkeletonRow', () => {
  test('renders without crashing', () => {
    const { container } = render(<SkeletonRow />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('is aria-hidden', () => {
    const { container } = render(<SkeletonRow />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('SkeletonNotification', () => {
  test('renders without crashing', () => {
    const { container } = render(<SkeletonNotification />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('is aria-hidden', () => {
    const { container } = render(<SkeletonNotification />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('SkeletonDashboard', () => {
  test('has role=status', () => {
    render(<SkeletonDashboard />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('has accessible label', () => {
    render(<SkeletonDashboard />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading dashboard');
  });

  test('renders 3 summary cards', () => {
    const { container } = render(<SkeletonDashboard />);
    // 3 cards in the summary grid + 1 transactions card = 4 direct card divs
    const grid = container.querySelector('.grid');
    expect(grid.children).toHaveLength(3);
  });
});

describe('SkeletonGrid', () => {
  test('has role=status', () => {
    render(<SkeletonGrid />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('renders default 6 cards', () => {
    const { container } = render(<SkeletonGrid />);
    // Each SkeletonCard has rounded-xl class
    expect(container.querySelectorAll('.rounded-xl')).toHaveLength(6);
  });

  test('renders custom count', () => {
    const { container } = render(<SkeletonGrid count={3} />);
    expect(container.querySelectorAll('.rounded-xl')).toHaveLength(3);
  });

  test('has accessible label', () => {
    render(<SkeletonGrid />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading items');
  });
});

describe('SkeletonLeaderboard', () => {
  test('has role=status', () => {
    render(<SkeletonLeaderboard />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('has accessible label', () => {
    render(<SkeletonLeaderboard />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading leaderboard');
  });

  test('renders default 10 rows', () => {
    const { container } = render(<SkeletonLeaderboard />);
    // header row + 10 data rows = 11 flex rows inside the container
    const rows = container.querySelectorAll('[aria-hidden="true"].flex');
    expect(rows).toHaveLength(11);
  });

  test('renders custom row count', () => {
    const { container } = render(<SkeletonLeaderboard rows={5} />);
    const rows = container.querySelectorAll('[aria-hidden="true"].flex');
    expect(rows).toHaveLength(6); // header + 5
  });
});

describe('SkeletonAnalytics', () => {
  test('has role=status', () => {
    render(<SkeletonAnalytics />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('has accessible label', () => {
    render(<SkeletonAnalytics />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading analytics');
  });

  test('renders 4 stat cards', () => {
    const { container } = render(<SkeletonAnalytics />);
    const statGrid = container.querySelector('.grid');
    expect(statGrid.children).toHaveLength(4);
  });
});

describe('SkeletonProfile', () => {
  test('has role=status', () => {
    render(<SkeletonProfile />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('has accessible label', () => {
    render(<SkeletonProfile />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading profile');
  });
});

describe('SkeletonTransactionHistory', () => {
  test('has role=status', () => {
    render(<SkeletonTransactionHistory />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('has accessible label', () => {
    render(<SkeletonTransactionHistory />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading transaction history');
  });

  test('renders custom row count', () => {
    const { container } = render(<SkeletonTransactionHistory rows={3} />);
    // SkeletonRow renders a div with border-b class
    const rows = container.querySelectorAll('.border-b.border-slate-100');
    expect(rows).toHaveLength(3);
  });
});

describe('SkeletonMerchantDashboard', () => {
  test('has role=status', () => {
    render(<SkeletonMerchantDashboard />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('has accessible label', () => {
    render(<SkeletonMerchantDashboard />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading merchant dashboard');
  });

  test('renders 4 KPI cards', () => {
    const { container } = render(<SkeletonMerchantDashboard />);
    const kpiGrid = container.querySelector('.grid');
    expect(kpiGrid.children).toHaveLength(4);
  });
});
