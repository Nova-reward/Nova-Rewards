/**
 * Nova Rewards — Type-Safe API Call Modules
 *
 * Centralised, strongly-typed wrappers around every backend endpoint.
 * All functions:
 *  - Return normalised, camelCase-keyed domain types
 *  - Accept an optional AbortSignal for request cancellation
 *  - Throw ApiError on failure (never raw Axios errors)
 *
 * Grouped by domain:
 *  - auth
 *  - users
 *  - campaigns
 *  - rewards
 *  - transactions
 *  - merchant
 *  - admin
 */

import apiClient from './apiClient';
import { unwrapEnvelope, unwrapPaginated, PaginatedResult } from './apiTransforms';
import type {
  User,
  Campaign,
  Reward,
  Redemption,
  Transaction,
} from '../types/index';

// ---------------------------------------------------------------------------
// Shared param types
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface CursorParams {
  limit?: number;
  cursor?: string;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  walletAddress?: string;
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export const authApi = {
  login(payload: LoginPayload, signal?: AbortSignal): Promise<AuthResponse> {
    return apiClient
      .post<unknown>('/auth/login', payload, { signal })
      .then((r) => unwrapEnvelope<AuthResponse>(r.data));
  },

  register(payload: RegisterPayload, signal?: AbortSignal): Promise<AuthResponse> {
    return apiClient
      .post<unknown>('/auth/register', payload, { signal })
      .then((r) => unwrapEnvelope<AuthResponse>(r.data));
  },

  refresh(refreshToken: string, signal?: AbortSignal): Promise<AuthTokens> {
    return apiClient
      .post<unknown>('/auth/refresh', { refreshToken }, { signal })
      .then((r) => unwrapEnvelope<AuthTokens>(r.data));
  },

  logout(signal?: AbortSignal): Promise<void> {
    return apiClient
      .post<unknown>('/auth/logout', {}, { signal })
      .then(() => undefined);
  },

  requestPasswordReset(email: string, signal?: AbortSignal): Promise<void> {
    return apiClient
      .post<unknown>('/auth/password-reset/request', { email }, { signal })
      .then(() => undefined);
  },

  resetPassword(
    token: string,
    newPassword: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return apiClient
      .post<unknown>('/auth/password-reset/confirm', { token, newPassword }, { signal })
      .then(() => undefined);
  },
};

// ---------------------------------------------------------------------------
// Users API
// ---------------------------------------------------------------------------

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  walletAddress?: string;
}

export interface UserBalance {
  walletAddress: string;
  novaBalance: string;
  pointsBalance: number;
  lastUpdatedAt: string;
}

export const usersApi = {
  getMe(signal?: AbortSignal): Promise<User> {
    return apiClient
      .get<unknown>('/users/me', { signal })
      .then((r) => unwrapEnvelope<User>(r.data));
  },

  getById(userId: number, signal?: AbortSignal): Promise<User> {
    return apiClient
      .get<unknown>(`/users/${userId}`, { signal })
      .then((r) => unwrapEnvelope<User>(r.data));
  },

  updateProfile(payload: UpdateProfilePayload, signal?: AbortSignal): Promise<User> {
    return apiClient
      .patch<unknown>('/users/profile', payload, { signal })
      .then((r) => unwrapEnvelope<User>(r.data));
  },

  getBalance(userId: number, signal?: AbortSignal): Promise<UserBalance> {
    return apiClient
      .get<unknown>(`/users/${userId}/balance`, { signal })
      .then((r) => unwrapEnvelope<UserBalance>(r.data));
  },

  getLeaderboard(
    params: PaginationParams = {},
    signal?: AbortSignal,
  ): Promise<PaginatedResult<User>> {
    return apiClient
      .get<unknown>('/users/leaderboard', { params, signal })
      .then((r) => unwrapPaginated<User>(r.data));
  },
};

// ---------------------------------------------------------------------------
// Campaigns API
// ---------------------------------------------------------------------------

export interface CampaignFilters extends PaginationParams {
  search?: string;
  category?: string;
  rewardType?: string;
  merchantId?: string;
  status?: 'active' | 'paused' | 'completed';
}

export interface CreateCampaignPayload {
  name: string;
  description?: string;
  rewardRate: number;
  startDate: string;
  endDate: string;
  category?: string;
  rewardType?: string;
}

export const campaignsApi = {
  list(
    filters: CampaignFilters = {},
    signal?: AbortSignal,
  ): Promise<PaginatedResult<Campaign>> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '' && v != null),
    );
    return apiClient
      .get<unknown>('/api/campaigns/public', { params, signal })
      .then((r) => unwrapPaginated<Campaign>(r.data));
  },

  getById(id: number | string, signal?: AbortSignal): Promise<Campaign> {
    return apiClient
      .get<unknown>(`/api/campaigns/public/${id}`, { signal })
      .then((r) => unwrapEnvelope<Campaign>(r.data));
  },

  create(
    payload: CreateCampaignPayload,
    signal?: AbortSignal,
  ): Promise<Campaign> {
    return apiClient
      .post<unknown>('/api/campaigns', payload, { signal })
      .then((r) => unwrapEnvelope<Campaign>(r.data));
  },

  update(
    id: number | string,
    payload: Partial<CreateCampaignPayload>,
    signal?: AbortSignal,
  ): Promise<Campaign> {
    return apiClient
      .patch<unknown>(`/api/campaigns/${id}`, payload, { signal })
      .then((r) => unwrapEnvelope<Campaign>(r.data));
  },

  delete(id: number | string, signal?: AbortSignal): Promise<void> {
    return apiClient
      .delete<unknown>(`/api/campaigns/${id}`, { signal })
      .then(() => undefined);
  },

  getCategories(signal?: AbortSignal): Promise<string[]> {
    return apiClient
      .get<unknown>('/api/campaigns/categories', { signal })
      .then((r) => unwrapEnvelope<string[]>(r.data) ?? []);
  },
};

// ---------------------------------------------------------------------------
// Rewards API
// ---------------------------------------------------------------------------

export interface RewardsFilters extends PaginationParams {
  isActive?: boolean;
}

export const rewardsApi = {
  list(
    filters: RewardsFilters = {},
    signal?: AbortSignal,
  ): Promise<PaginatedResult<Reward>> {
    return apiClient
      .get<unknown>('/rewards', { params: filters, signal })
      .then((r) => unwrapPaginated<Reward>(r.data));
  },

  getById(id: number | string, signal?: AbortSignal): Promise<Reward> {
    return apiClient
      .get<unknown>(`/rewards/${id}`, { signal })
      .then((r) => unwrapEnvelope<Reward>(r.data));
  },

  redeem(
    rewardId: number | string,
    signal?: AbortSignal,
  ): Promise<Redemption> {
    return apiClient
      .post<unknown>('/redemptions', { rewardId }, { signal })
      .then((r) => unwrapEnvelope<Redemption>(r.data));
  },

  getRedemptions(
    params: PaginationParams = {},
    signal?: AbortSignal,
  ): Promise<PaginatedResult<Redemption>> {
    return apiClient
      .get<unknown>('/redemptions', { params, signal })
      .then((r) => unwrapPaginated<Redemption>(r.data));
  },
};

// ---------------------------------------------------------------------------
// Transactions API
// ---------------------------------------------------------------------------

export interface TransactionFilters extends CursorParams {
  type?: Transaction['txType'];
  dateFrom?: string;
  dateTo?: string;
  campaignId?: number | string;
  status?: Transaction['status'];
}

export interface TransactionStats {
  totalCount: number;
  totalAmount: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

export const transactionsApi = {
  list(
    userId: number | string,
    filters: TransactionFilters = {},
    signal?: AbortSignal,
  ): Promise<PaginatedResult<Transaction>> {
    const params = Object.fromEntries(
      Object.entries({ userId, ...filters }).filter(([, v]) => v != null),
    );
    return apiClient
      .get<unknown>('/api/transactions/history', { params, signal })
      .then((r) => unwrapPaginated<Transaction>(r.data));
  },

  getById(id: number | string, signal?: AbortSignal): Promise<Transaction> {
    return apiClient
      .get<unknown>(`/api/transactions/${id}`, { signal })
      .then((r) => unwrapEnvelope<Transaction>(r.data));
  },

  getStats(
    userId: number | string,
    filters: Pick<TransactionFilters, 'dateFrom' | 'dateTo'> = {},
    signal?: AbortSignal,
  ): Promise<TransactionStats> {
    return apiClient
      .get<unknown>('/api/transactions/stats', {
        params: { userId, ...filters },
        signal,
      })
      .then((r) => unwrapEnvelope<TransactionStats>(r.data));
  },

  exportCsv(
    userId: number | string,
    filters: Omit<TransactionFilters, 'cursor'> = {},
    signal?: AbortSignal,
  ): Promise<Blob> {
    return apiClient
      .get<Blob>('/api/transactions/export/csv', {
        params: { userId, limit: 10_000, ...filters },
        responseType: 'blob',
        signal,
      })
      .then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Merchant API
// ---------------------------------------------------------------------------

export interface Merchant {
  id: number;
  name: string;
  email: string;
  logoUrl?: string;
  websiteUrl?: string;
  createdAt: string;
}

export interface MerchantStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalRedemptions: number;
  totalTokensDistributed: number;
}

export const merchantApi = {
  getProfile(signal?: AbortSignal): Promise<Merchant> {
    return apiClient
      .get<unknown>('/api/merchant/profile', { signal })
      .then((r) => unwrapEnvelope<Merchant>(r.data));
  },

  updateProfile(
    payload: Partial<Pick<Merchant, 'name' | 'logoUrl' | 'websiteUrl'>>,
    signal?: AbortSignal,
  ): Promise<Merchant> {
    return apiClient
      .patch<unknown>('/api/merchant/profile', payload, { signal })
      .then((r) => unwrapEnvelope<Merchant>(r.data));
  },

  getStats(signal?: AbortSignal): Promise<MerchantStats> {
    return apiClient
      .get<unknown>('/api/merchant/stats', { signal })
      .then((r) => unwrapEnvelope<MerchantStats>(r.data));
  },

  getCampaigns(
    params: PaginationParams = {},
    signal?: AbortSignal,
  ): Promise<PaginatedResult<Campaign>> {
    return apiClient
      .get<unknown>('/api/merchant/campaigns', { params, signal })
      .then((r) => unwrapPaginated<Campaign>(r.data));
  },
};

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

export interface AdminStats {
  totalUsers: number;
  totalMerchants: number;
  totalTokensIssued: number;
  totalRedemptions: number;
  activeCampaigns: number;
}

export interface AdminUserFilters extends PaginationParams {
  search?: string;
  role?: User['role'];
}

export const adminApi = {
  getStats(signal?: AbortSignal): Promise<AdminStats> {
    return apiClient
      .get<unknown>('/admin/stats', { signal })
      .then((r) => unwrapEnvelope<AdminStats>(r.data));
  },

  listUsers(
    filters: AdminUserFilters = {},
    signal?: AbortSignal,
  ): Promise<PaginatedResult<User>> {
    return apiClient
      .get<unknown>('/admin/users', { params: filters, signal })
      .then((r) => unwrapPaginated<User>(r.data));
  },

  updateUserRole(
    userId: number,
    role: User['role'],
    signal?: AbortSignal,
  ): Promise<User> {
    return apiClient
      .patch<unknown>(`/admin/users/${userId}/role`, { role }, { signal })
      .then((r) => unwrapEnvelope<User>(r.data));
  },
};
