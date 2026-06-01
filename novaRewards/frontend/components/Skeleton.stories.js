import React from 'react';
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
} from './Skeleton';

export default {
  title: 'Components/Skeleton',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export const Block = () => (
  <div className="flex flex-col gap-3 w-80">
    <SkeletonBlock className="h-4 w-full" />
    <SkeletonBlock className="h-4 w-3/4" />
    <SkeletonBlock className="h-4 w-1/2" />
  </div>
);

export const Card = () => (
  <div className="w-72">
    <SkeletonCard />
  </div>
);

export const CardNoImage = () => (
  <div className="w-72">
    <SkeletonCard showImage={false} />
  </div>
);

export const Row = () => (
  <div className="w-full max-w-lg">
    {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
  </div>
);

export const Notification = () => (
  <div className="w-full max-w-sm">
    {[...Array(3)].map((_, i) => <SkeletonNotification key={i} />)}
  </div>
);

export const Dashboard = () => <SkeletonDashboard />;

export const Grid = () => <SkeletonGrid count={6} />;

export const Leaderboard = () => <SkeletonLeaderboard rows={8} />;

export const Analytics = () => <SkeletonAnalytics />;

export const Profile = () => <SkeletonProfile />;

export const TransactionHistory = () => <SkeletonTransactionHistory rows={6} />;

export const MerchantDashboard = () => <SkeletonMerchantDashboard />;
