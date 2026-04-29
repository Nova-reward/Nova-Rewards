/**
 * Shared TypeScript types for the Nova Rewards App Router.
 * Closes #598
 */

// ── API response envelope ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// ── Domain types ─────────────────────────────────────────────────────────────

export interface User {
  id: number;
  walletAddress: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: 'user' | 'admin' | 'merchant';
  createdAt: string;
}

export interface Campaign {
  id: number;
  merchantId: number;
  name: string;
  rewardRate: number;
  startDate: string;
  endDate: string;
  onChainStatus: 'pending' | 'confirmed' | 'failed';
  contractCampaignId?: string;
  createdAt: string;
}

export interface Reward {
  id: number;
  name: string;
  description?: string;
  pointsCost: number;
  stock?: number;
  isActive: boolean;
}

export interface Redemption {
  id: number;
  userId: number;
  rewardId: number;
  campaignId?: number;
  pointsSpent: number;
  createdAt: string;
}

export interface Transaction {
  id: number;
  txHash: string;
  txType: 'distribution' | 'redemption' | 'transfer';
  amount?: number;
  fromWallet?: string;
  toWallet?: string;
  status: 'pending' | 'confirmed' | 'failed' | 'refunded';
  createdAt: string;
}

// ── Navigation ────────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  adminOnly?: boolean;
}

// ── Component props ───────────────────────────────────────────────────────────

export interface WithChildren {
  children: React.ReactNode;
}

export interface WithClassName {
  className?: string;
}
