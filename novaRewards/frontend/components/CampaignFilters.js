'use client';

/**
 * CampaignFilters — sidebar filter panel for the campaign discovery page.
 *
 * Filters: category, reward type, merchant (free-text), status.
 * Emits a single `filters` object via `onChange` on every change.
 *
 * Requirements: #598 (filter sidebar: category, reward type, merchant, status)
 */

const REWARD_TYPES = ['token', 'cashback', 'points', 'voucher', 'nft'];
const STATUSES     = ['active', 'paused', 'completed'];

export default function CampaignFilters({ filters, categories, onChange, onReset, resultCount }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  const hasActiveFilters =
    filters.search ||
    (filters.category && filters.category !== 'all') ||
    (filters.rewardType && filters.rewardType !== 'all') ||
    filters.merchant ||
    (filters.status && filters.status !== 'all');

  return (
    <aside
      aria-label="Campaign filters"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        height: 'fit-content',
        position: 'sticky',
        top: '1.5rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
          🔍 Filters
        </h2>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              padding: 0,
              fontWeight: 600,
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Result count */}
      <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '-0.75rem' }}>
        {resultCount} campaign{resultCount !== 1 ? 's' : ''} found
      </p>

      {/* Search */}
      <FilterGroup label="Search">
        <input
          className="input"
          style={{ marginBottom: 0 }}
          type="search"
          placeholder="Campaign or merchant name…"
          value={filters.search}
          onChange={set('search')}
          aria-label="Search campaigns"
        />
      </FilterGroup>

      {/* Category */}
      <FilterGroup label="Category">
        <select
          className="input"
          style={{ marginBottom: 0 }}
          value={filters.category}
          onChange={set('category')}
          aria-label="Filter by category"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c} style={{ textTransform: 'capitalize' }}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </FilterGroup>

      {/* Reward type */}
      <FilterGroup label="Reward Type">
        <select
          className="input"
          style={{ marginBottom: 0 }}
          value={filters.rewardType}
          onChange={set('rewardType')}
          aria-label="Filter by reward type"
        >
          <option value="all">All Types</option>
          {REWARD_TYPES.map((t) => (
            <option key={t} value={t} style={{ textTransform: 'capitalize' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </FilterGroup>

      {/* Merchant */}
      <FilterGroup label="Merchant">
        <input
          className="input"
          style={{ marginBottom: 0 }}
          type="search"
          placeholder="Filter by merchant…"
          value={filters.merchant}
          onChange={set('merchant')}
          aria-label="Filter by merchant name"
        />
      </FilterGroup>

      {/* Status */}
      <FilterGroup label="Status">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <StatusRadio value="all"       current={filters.status} onChange={set('status')} label="All" />
          {STATUSES.map((s) => (
            <StatusRadio key={s} value={s} current={filters.status} onChange={set('status')} label={s.charAt(0).toUpperCase() + s.slice(1)} />
          ))}
        </div>
      </FilterGroup>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterGroup({ label, children }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.4rem',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusRadio({ value, current, onChange, label }) {
  const checked = current === value;
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.875rem',
        color: checked ? 'var(--text)' : 'var(--muted)',
        fontWeight: checked ? 600 : 400,
      }}
    >
      <input
        type="radio"
        name="campaign-status"
        value={value}
        checked={checked}
        onChange={onChange}
        style={{ accentColor: 'var(--accent)' }}
      />
      {label}
    </label>
  );
}
