import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import CampaignCard from '../components/CampaignCard';
import CampaignFilters from '../components/CampaignFilters';
import { fetchPublicCampaigns } from '../lib/campaignsApi';

// Detail modal is heavy (router events, focus trap) — load client-side only
const CampaignDetailModal = dynamic(
  () => import('../components/CampaignDetailModal'),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 12;

const DEFAULT_FILTERS = {
  search:     '',
  category:   'all',
  rewardType: 'all',
  merchant:   '',
  status:     'all',
};

// ---------------------------------------------------------------------------
// Skeleton grid shown while loading
// ---------------------------------------------------------------------------

function CampaignCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div className="skeleton-block" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton-block" style={{ height: 12, width: '60%', marginBottom: 6, borderRadius: 4 }} />
          <div className="skeleton-block" style={{ height: 16, width: '85%', borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="skeleton-block" style={{ height: 12, borderRadius: 4 }} />
        <div className="skeleton-block" style={{ height: 12, width: '70%', borderRadius: 4 }} />
        <div className="skeleton-block" style={{ height: 52, borderRadius: 8 }} />
        <div className="skeleton-block" style={{ height: 12, width: '50%', borderRadius: 4 }} />
      </div>
      <div style={{ padding: '0 1.25rem 1.25rem' }}>
        <div className="skeleton-block" style={{ height: 38, borderRadius: 8 }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * Campaign Discovery page — public-facing browse page for all campaigns.
 *
 * Features:
 *  - Grid of CampaignCards with merchant logo, reward amount, expiry
 *  - Filter sidebar: category, reward type, merchant, status
 *  - Search bar filters by name or merchant
 *  - Pagination (load-more style) for large lists
 *  - Campaign detail modal with full eligibility rules
 *
 * Requirements: #598
 */
function CampaignsContent() {
  // ── Data state ──────────────────────────────────────────────────────────
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [error, setError]               = useState(null);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(false);
  const [total, setTotal]               = useState(0);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // ── Modal state ──────────────────────────────────────────────────────────
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // ── Sidebar toggle (mobile) ───────────────────────────────────────────────
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── Infinite scroll sentinel ─────────────────────────────────────────────
  const sentinelRef = useRef(null);

  // ── Derived: categories from loaded campaigns ─────────────────────────────
  const categories = useMemo(() => {
    const cats = new Set(allCampaigns.map((c) => c.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [allCampaigns]);

  // ── Client-side filtering (applied on top of server results) ─────────────
  // The server handles category/rewardType/status; we also filter client-side
  // so the UI feels instant while the next page loads.
  const filteredCampaigns = useMemo(() => {
    const { search, category, rewardType, merchant, status } = filters;
    return allCampaigns.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.merchantName.toLowerCase().includes(q)) return false;
      }
      if (category && category !== 'all' && c.category !== category) return false;
      if (rewardType && rewardType !== 'all' && c.rewardType !== rewardType) return false;
      if (merchant && !c.merchantName.toLowerCase().includes(merchant.toLowerCase())) return false;
      if (status && status !== 'all' && c.status !== status) return false;
      return true;
    });
  }, [allCampaigns, filters]);

  // ── Load first page ───────────────────────────────────────────────────────
  const loadCampaigns = useCallback(async (resetPage = true) => {
    if (resetPage) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const currentPage = resetPage ? 1 : page + 1;
      const result = await fetchPublicCampaigns({
        page: currentPage,
        limit: PAGE_SIZE,
        // Pass server-side filters for efficiency
        category:   filters.category !== 'all'   ? filters.category   : undefined,
        rewardType: filters.rewardType !== 'all' ? filters.rewardType : undefined,
        status:     filters.status !== 'all'     ? filters.status     : undefined,
      });

      if (resetPage) {
        setAllCampaigns(result.campaigns);
      } else {
        setAllCampaigns((prev) => [...prev, ...result.campaigns]);
        setPage(currentPage);
      }
      setHasMore(result.hasMore);
      setTotal(result.total);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load campaigns.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters.category, filters.rewardType, filters.status, page]);

  // Reload when server-side filters change
  useEffect(() => {
    loadCampaigns(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.rewardType, filters.status]);

  // Initial load
  useEffect(() => {
    loadCampaigns(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Infinite scroll via IntersectionObserver ──────────────────────────────
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadCampaigns(false);
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadCampaigns]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleFiltersChange = (newFilters) => setFilters(newFilters);
  const handleReset         = () => setFilters(DEFAULT_FILTERS);
  const handleViewDetails   = (campaign) => setSelectedCampaign(campaign);
  const handleCloseModal    = () => setSelectedCampaign(null);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1rem' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          🎯 Browse Campaigns
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
          Discover reward campaigns from merchants and start earning NOVA tokens.
        </p>
      </div>

      {/* ── Mobile filter toggle ── */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.85rem' }}
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="campaign-filters-panel"
        >
          {filtersOpen ? '✕ Hide Filters' : '⚙ Filters'}
          {Object.values(filters).some((v) => v && v !== 'all') && (
            <span
              style={{
                marginLeft: '0.4rem',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: '9999px',
                fontSize: '0.7rem',
                padding: '1px 6px',
                fontWeight: 700,
              }}
            >
              •
            </span>
          )}
        </button>

        {/* Inline search on mobile */}
        <input
          className="input"
          style={{ marginBottom: 0, flex: 1 }}
          type="search"
          placeholder="Search campaigns…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          aria-label="Search campaigns"
        />
      </div>

      {/* ── Main layout: sidebar + grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: '1.5rem',
        }}
        className="campaigns-layout"
      >
        {/* Filters sidebar */}
        <div
          id="campaign-filters-panel"
          style={{
            display: filtersOpen ? 'block' : 'none',
          }}
          className="campaigns-sidebar"
        >
          <CampaignFilters
            filters={filters}
            categories={categories}
            onChange={handleFiltersChange}
            onReset={handleReset}
            resultCount={filteredCampaigns.length}
          />
        </div>

        {/* Campaign grid */}
        <div className="campaigns-main">
          {/* Error state */}
          {error && !loading && (
            <div
              className="card"
              style={{ textAlign: 'center', padding: '2rem', marginBottom: '1rem' }}
            >
              <p className="error" style={{ marginBottom: '0.75rem' }}>⚠️ {error}</p>
              <button className="btn btn-secondary" onClick={() => loadCampaigns(true)}>
                Try Again
              </button>
            </div>
          )}

          {/* Loading state — first page */}
          {loading && (
            <div className="campaigns-grid">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <CampaignCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredCampaigns.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 1rem',
                color: 'var(--muted)',
              }}
            >
              <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</p>
              <p style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text)' }}>
                No campaigns found
              </p>
              <p style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Try adjusting your filters or search term.
              </p>
              <button className="btn btn-secondary" onClick={handleReset}>
                Clear Filters
              </button>
            </div>
          )}

          {/* Campaign grid */}
          {!loading && filteredCampaigns.length > 0 && (
            <>
              {/* Result summary */}
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                Showing {filteredCampaigns.length} of {total} campaign{total !== 1 ? 's' : ''}
              </p>

              <div className="campaigns-grid">
                {filteredCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>

              {/* Load-more / infinite scroll sentinel */}
              {hasMore && (
                <div ref={sentinelRef} style={{ marginTop: '2rem', textAlign: 'center' }}>
                  {loadingMore ? (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
                      <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                      Loading more…
                    </div>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      onClick={() => loadCampaigns(false)}
                      style={{ minWidth: '160px' }}
                    >
                      Load More
                    </button>
                  )}
                </div>
              )}

              {/* End of results */}
              {!hasMore && filteredCampaigns.length > 0 && allCampaigns.length > PAGE_SIZE && (
                <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
                  All {total} campaigns loaded
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Detail modal ── */}
      {selectedCampaign && (
        <CampaignDetailModal
          campaign={selectedCampaign}
          onClose={handleCloseModal}
        />
      )}

      {/* ── Responsive styles ── */}
      <style jsx>{`
        /* Desktop: sidebar + grid side by side */
        @media (min-width: 900px) {
          .campaigns-layout {
            grid-template-columns: 240px minmax(0, 1fr) !important;
          }
          .campaigns-sidebar {
            display: block !important;
          }
        }

        .campaigns-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.25rem;
        }

        @media (max-width: 480px) {
          .campaigns-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Spinner reuse */
        .loading-spinner {
          display: inline-block;
          width: 24px;
          height: 24px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 400ms linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

function CampaignsPage() {
  return (
    <ErrorBoundary>
      <CampaignsContent />
    </ErrorBoundary>
  );
}

CampaignsPage.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default CampaignsPage;
