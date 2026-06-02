/**
 * Campaign discovery API helpers.
 *
 * All functions return normalised campaign objects so the UI never has to
 * deal with snake_case vs camelCase inconsistencies from the backend.
 */

import api from './api';

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Campaign
 * @property {string}  id
 * @property {string}  name
 * @property {string}  [description]
 * @property {string}  [category]        - e.g. "food", "retail", "travel"
 * @property {string}  [rewardType]      - e.g. "cashback", "points", "token"
 * @property {number}  rewardRate        - NOVA per unit
 * @property {string}  [merchantId]
 * @property {string}  [merchantName]
 * @property {string}  [merchantLogo]
 * @property {string}  startDate         - ISO date string
 * @property {string}  endDate           - ISO date string
 * @property {string}  status            - "active" | "paused" | "completed"
 * @property {number}  [participantCount]
 * @property {string}  [eligibilityRules]
 * @property {string[]} [tags]
 */

// ---------------------------------------------------------------------------
// Normaliser
// ---------------------------------------------------------------------------

/**
 * Converts a raw backend campaign object to a consistent camelCase shape.
 * Handles both snake_case (direct DB rows) and camelCase (API layer) responses.
 *
 * @param {object} raw
 * @returns {Campaign}
 */
export function normaliseCampaign(raw) {
  const now = new Date();
  const end = new Date(raw.end_date || raw.endDate || now);
  const start = new Date(raw.start_date || raw.startDate || now);
  const isActive = raw.is_active ?? raw.isActive ?? true;

  let status = 'active';
  if (end < now) status = 'completed';
  else if (!isActive) status = 'paused';

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? raw.desc ?? '',
    category: raw.category ?? '',
    rewardType: raw.reward_type ?? raw.rewardType ?? 'token',
    rewardRate: parseFloat(raw.reward_rate ?? raw.rewardRate ?? 0),
    merchantId: raw.merchant_id ?? raw.merchantId ?? '',
    merchantName: raw.merchant_name ?? raw.merchantName ?? raw.merchant?.name ?? '',
    merchantLogo: raw.merchant_logo ?? raw.merchantLogo ?? raw.merchant?.logo ?? '',
    startDate: raw.start_date ?? raw.startDate ?? '',
    endDate: raw.end_date ?? raw.endDate ?? '',
    status,
    participantCount: raw.participant_count ?? raw.participantCount ?? 0,
    eligibilityRules: raw.eligibility_rules ?? raw.eligibilityRules ?? '',
    tags: raw.tags ?? [],
  };
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated list of public campaigns.
 *
 * @param {{ page?: number, limit?: number, search?: string, category?: string, rewardType?: string, merchantId?: string, status?: string }} params
 * @returns {Promise<{ campaigns: Campaign[], total: number, hasMore: boolean }>}
 */
export async function fetchPublicCampaigns(params = {}) {
  const { page = 1, limit = 12, ...filters } = params;

  // Strip empty filter values so the URL stays clean
  const query = Object.fromEntries(
    Object.entries({ page, limit, ...filters }).filter(([, v]) => v !== '' && v !== 'all' && v != null)
  );

  const res = await api.get('/api/campaigns/public', { params: query });
  const data = res.data;

  // Support both paginated envelope and plain array responses
  if (Array.isArray(data)) {
    const campaigns = data.map(normaliseCampaign);
    return { campaigns, total: campaigns.length, hasMore: false };
  }

  const campaigns = (data.data ?? data.campaigns ?? []).map(normaliseCampaign);
  return {
    campaigns,
    total: data.total ?? campaigns.length,
    hasMore: data.hasMore ?? data.has_more ?? false,
  };
}

/**
 * Fetch a single campaign by ID (for the detail modal).
 *
 * @param {string} id
 * @returns {Promise<Campaign>}
 */
export async function fetchCampaignById(id) {
  const res = await api.get(`/api/campaigns/public/${id}`);
  const raw = res.data?.data ?? res.data;
  return normaliseCampaign(raw);
}

/**
 * Fetch the list of distinct categories available across all campaigns.
 * Falls back to deriving them client-side from a campaign list.
 *
 * @returns {Promise<string[]>}
 */
export async function fetchCampaignCategories() {
  try {
    const res = await api.get('/api/campaigns/categories');
    return res.data?.data ?? res.data ?? [];
  } catch {
    return [];
  }
}
