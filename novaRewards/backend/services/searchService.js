/**
 * Search Service — Elasticsearch integration
 *
 * Responsibilities:
 *  - Manage ES client lifecycle
 *  - Index rewards, campaigns, and users
 *  - Full-text + faceted search with relevance ranking
 *  - Autocomplete suggestions via completion suggester
 *  - Expose index/delete helpers for event-driven sync
 */

const { Client } = require('@elastic/elasticsearch');

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let esClient = null;

function getClient() {
  if (!esClient) {
    esClient = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: process.env.ELASTICSEARCH_API_KEY
        ? { apiKey: process.env.ELASTICSEARCH_API_KEY }
        : undefined,
      tls: process.env.ELASTICSEARCH_CA_CERT
        ? { ca: process.env.ELASTICSEARCH_CA_CERT, rejectUnauthorized: true }
        : undefined,
    });
  }
  return esClient;
}

// ---------------------------------------------------------------------------
// Index names
// ---------------------------------------------------------------------------

const INDICES = {
  rewards:   'nova_rewards',
  campaigns: 'nova_campaigns',
  users:     'nova_users',
};

// ---------------------------------------------------------------------------
// Index mappings
// ---------------------------------------------------------------------------

const MAPPINGS = {
  [INDICES.rewards]: {
    mappings: {
      properties: {
        id:          { type: 'integer' },
        name:        { type: 'text', analyzer: 'standard', fields: { keyword: { type: 'keyword' } } },
        description: { type: 'text', analyzer: 'standard' },
        cost:        { type: 'float' },
        stock:       { type: 'integer' },
        is_active:   { type: 'boolean' },
        created_at:  { type: 'date' },
        suggest: {
          type: 'completion',
          analyzer: 'simple',
          preserve_separators: true,
          preserve_position_increments: true,
          max_input_length: 50,
        },
      },
    },
  },
  [INDICES.campaigns]: {
    mappings: {
      properties: {
        id:          { type: 'integer' },
        name:        { type: 'text', analyzer: 'standard', fields: { keyword: { type: 'keyword' } } },
        description: { type: 'text', analyzer: 'standard' },
        merchant_id: { type: 'integer' },
        is_active:   { type: 'boolean' },
        start_date:  { type: 'date' },
        end_date:    { type: 'date' },
        created_at:  { type: 'date' },
        suggest: {
          type: 'completion',
          analyzer: 'simple',
          preserve_separators: true,
          preserve_position_increments: true,
          max_input_length: 50,
        },
      },
    },
  },
  [INDICES.users]: {
    mappings: {
      properties: {
        id:             { type: 'integer' },
        email:          { type: 'text', analyzer: 'standard', fields: { keyword: { type: 'keyword' } } },
        first_name:     { type: 'text', analyzer: 'standard' },
        last_name:      { type: 'text', analyzer: 'standard' },
        wallet_address: { type: 'keyword' },
        role:           { type: 'keyword' },
        created_at:     { type: 'date' },
        suggest: {
          type: 'completion',
          analyzer: 'simple',
          preserve_separators: true,
          preserve_position_increments: true,
          max_input_length: 50,
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Bootstrap — create indices if they don't exist
// ---------------------------------------------------------------------------

async function ensureIndices() {
  const client = getClient();
  for (const [index, body] of Object.entries(MAPPINGS)) {
    const exists = await client.indices.exists({ index });
    if (!exists) {
      await client.indices.create({ index, ...body });
      console.log(`[Search] Created index: ${index}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Document helpers — build the ES doc from a DB row
// ---------------------------------------------------------------------------

function rewardToDoc(reward) {
  return {
    id:          reward.id,
    name:        reward.name,
    description: reward.description || '',
    cost:        parseFloat(reward.cost),
    stock:       reward.stock ?? null,
    is_active:   reward.is_active ?? true,
    created_at:  reward.created_at,
    suggest: {
      input:  [reward.name, ...(reward.description ? [reward.description.slice(0, 50)] : [])],
      weight: reward.is_active ? 10 : 1,
    },
  };
}

function campaignToDoc(campaign) {
  return {
    id:          campaign.id,
    name:        campaign.name,
    description: campaign.description || '',
    merchant_id: campaign.merchant_id,
    is_active:   campaign.is_active ?? true,
    start_date:  campaign.start_date || null,
    end_date:    campaign.end_date || null,
    created_at:  campaign.created_at,
    suggest: {
      input:  [campaign.name],
      weight: campaign.is_active ? 10 : 1,
    },
  };
}

function userToDoc(user) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return {
    id:             user.id,
    email:          user.email || '',
    first_name:     user.first_name || '',
    last_name:      user.last_name || '',
    wallet_address: user.wallet_address,
    role:           user.role || 'user',
    created_at:     user.created_at,
    suggest: {
      input:  [fullName, user.email, user.wallet_address].filter(Boolean),
      weight: 5,
    },
  };
}

// ---------------------------------------------------------------------------
// Index / delete single documents
// ---------------------------------------------------------------------------

async function indexReward(reward) {
  await getClient().index({ index: INDICES.rewards, id: String(reward.id), document: rewardToDoc(reward) });
}

async function indexCampaign(campaign) {
  await getClient().index({ index: INDICES.campaigns, id: String(campaign.id), document: campaignToDoc(campaign) });
}

async function indexUser(user) {
  await getClient().index({ index: INDICES.users, id: String(user.id), document: userToDoc(user) });
}

async function deleteDocument(entityType, id) {
  const index = INDICES[entityType];
  if (!index) throw new Error(`Unknown entity type: ${entityType}`);
  await getClient().delete({ index, id: String(id) });
}

// ---------------------------------------------------------------------------
// Full-text + faceted search
// ---------------------------------------------------------------------------

/**
 * Search across one or more entity types.
 *
 * @param {{
 *   q: string,
 *   entityType?: 'rewards'|'campaigns'|'users'|'all',
 *   filters?: { is_active?: boolean, merchant_id?: number, role?: string },
 *   page?: number,
 *   limit?: number,
 * }} opts
 * @returns {Promise<{ hits: object[], total: number, facets: object, durationMs: number }>}
 */
async function search({ q, entityType = 'all', filters = {}, page = 1, limit = 20 }) {
  const client = getClient();
  const from = (page - 1) * limit;

  // Determine which indices to query
  const indices = entityType === 'all'
    ? Object.values(INDICES)
    : [INDICES[entityType]].filter(Boolean);

  if (!indices.length) throw new Error(`Unknown entity type: ${entityType}`);

  // Build filter clauses
  const filterClauses = [];
  if (filters.is_active !== undefined) {
    filterClauses.push({ term: { is_active: filters.is_active } });
  }
  if (filters.merchant_id !== undefined) {
    filterClauses.push({ term: { merchant_id: filters.merchant_id } });
  }
  if (filters.role !== undefined) {
    filterClauses.push({ term: { role: filters.role } });
  }

  const esQuery = {
    bool: {
      must: q
        ? [
            {
              multi_match: {
                query: q,
                fields: ['name^3', 'description', 'email^2', 'first_name^2', 'last_name^2', 'wallet_address'],
                type: 'best_fields',
                fuzziness: 'AUTO',
                prefix_length: 1,
              },
            },
          ]
        : [{ match_all: {} }],
      filter: filterClauses,
    },
  };

  const t0 = Date.now();
  const response = await client.search({
    index: indices,
    from,
    size: limit,
    query: esQuery,
    highlight: {
      fields: {
        name:        { number_of_fragments: 0 },
        description: { number_of_fragments: 1, fragment_size: 150 },
        email:       { number_of_fragments: 0 },
      },
    },
    aggs: {
      by_type: {
        terms: { field: '_index', size: 10 },
      },
      active_count: {
        filter: { term: { is_active: true } },
      },
    },
  });
  const durationMs = Date.now() - t0;

  const hits = response.hits.hits.map((hit) => ({
    _type:      hit._index,
    _score:     hit._score,
    _highlight: hit.highlight || {},
    ...hit._source,
  }));

  const facets = {
    byType: (response.aggregations?.by_type?.buckets || []).map((b) => ({
      type:  b.key,
      count: b.doc_count,
    })),
    activeCount: response.aggregations?.active_count?.doc_count ?? null,
  };

  return {
    hits,
    total: response.hits.total?.value ?? response.hits.total ?? 0,
    facets,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// Autocomplete suggestions
// ---------------------------------------------------------------------------

/**
 * Returns completion suggestions for the given prefix.
 *
 * @param {{ prefix: string, entityType?: string, limit?: number }} opts
 * @returns {Promise<string[]>}
 */
async function suggest({ prefix, entityType = 'all', limit = 5 }) {
  const client = getClient();

  const indices = entityType === 'all'
    ? Object.values(INDICES)
    : [INDICES[entityType]].filter(Boolean);

  const response = await client.search({
    index: indices,
    suggest: {
      nova_suggest: {
        prefix,
        completion: {
          field: 'suggest',
          size:  limit,
          skip_duplicates: true,
          fuzzy: { fuzziness: 1 },
        },
      },
    },
    _source: false,
    size: 0,
  });

  const options = response.suggest?.nova_suggest?.[0]?.options ?? [];
  return [...new Set(options.map((o) => o.text))];
}

// ---------------------------------------------------------------------------
// Bulk reindex — call once on startup or via admin endpoint
// ---------------------------------------------------------------------------

/**
 * Bulk-indexes all rows from a Postgres query result into ES.
 *
 * @param {'rewards'|'campaigns'|'users'} entityType
 * @param {object[]} rows  - DB rows
 */
async function bulkIndex(entityType, rows) {
  if (!rows.length) return;
  const client = getClient();
  const index = INDICES[entityType];
  const toDoc = { rewards: rewardToDoc, campaigns: campaignToDoc, users: userToDoc }[entityType];

  const operations = rows.flatMap((row) => [
    { index: { _index: index, _id: String(row.id) } },
    toDoc(row),
  ]);

  const { errors, items } = await client.bulk({ operations, refresh: false });
  if (errors) {
    const failed = items.filter((i) => i.index?.error);
    console.error(`[Search] Bulk index errors (${failed.length}):`, failed.map((i) => i.index.error));
  }
  console.log(`[Search] Bulk indexed ${rows.length} ${entityType}`);
}

module.exports = {
  getClient,
  ensureIndices,
  indexReward,
  indexCampaign,
  indexUser,
  deleteDocument,
  search,
  suggest,
  bulkIndex,
  INDICES,
};
