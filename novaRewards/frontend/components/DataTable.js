import { useState, useMemo } from 'react';

/**
 * DataTable – reusable table component
 *
 * Props:
 *   columns: [{ key, label, sortable?, render? }]
 *   data:    array of row objects
 *   pageSize?: default rows per page (default 10)
 */
export default function DataTable({ columns = [], data = [], pageSize: defaultPageSize = 10 }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selected, setSelected] = useState(new Set());
  const [hiddenCols, setHiddenCols] = useState(new Set());
  const [showColMenu, setShowColMenu] = useState(false);

  const visibleCols = columns.filter((c) => !hiddenCols.has(c.key));

  // 1. Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      visibleCols.some((col) => String(row[col.key] ?? '').toLowerCase().includes(q))
    );
  }, [data, search, visibleCols]);

  // 2. Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // 3. Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id ?? r));
  const toggleAll = () => {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        pageRows.forEach((r) => next.delete(r.id ?? r));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        pageRows.forEach((r) => next.add(r.id ?? r));
        return next;
      });
    }
  };

  const toggleCol = (key) =>
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const exportData = (format) => {
    const rows = selected.size > 0 ? sorted.filter((r) => selected.has(r.id ?? r)) : sorted;
    if (format === 'csv') {
      const header = visibleCols.map((c) => c.label).join(',');
      const body = rows.map((r) => visibleCols.map((c) => `"${r[c.key] ?? ''}"`).join(','));
      download([header, ...body].join('\n'), 'export.csv', 'text/csv');
    } else {
      download(JSON.stringify(rows, null, 2), 'export.json', 'application/json');
    }
  };

  const download = (content, filename, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
  };

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={inputStyle}
          aria-label="Search table"
        />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Column visibility */}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-secondary" onClick={() => setShowColMenu((v) => !v)} aria-expanded={showColMenu}>
              Columns ▾
            </button>
            {showColMenu && (
              <div style={dropdownStyle} role="menu">
                {columns.map((col) => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!hiddenCols.has(col.key)}
                      onChange={() => toggleCol(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button className="btn btn-secondary" onClick={() => exportData('csv')}>Export CSV</button>
          <button className="btn btn-secondary" onClick={() => exportData('json')}>Export JSON</button>
        </div>
      </div>

      {selected.size > 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
          {selected.size} row{selected.size > 1 ? 's' : ''} selected
        </p>
      )}

      {/* Table */}
      <div className="table-scroll">
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '2.5rem' }}>
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleAll}
                  aria-label="Select all rows on this page"
                />
              </th>
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                  style={{ cursor: col.sortable !== false ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
                  aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {col.label}
                  {col.sortable !== false && (
                    <span style={{ marginLeft: '0.3rem', opacity: sortKey === col.key ? 1 : 0.35 }}>
                      {sortKey === col.key && sortDir === 'desc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length + 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                  No results found.
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => {
                const rowId = row.id ?? i;
                return (
                  <tr key={rowId} style={{ backgroundColor: selected.has(rowId) ? 'rgba(124,58,237,0.07)' : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(rowId)}
                        onChange={() => toggleRow(rowId)}
                        aria-label={`Select row ${rowId}`}
                      />
                    </td>
                    {visibleCols.map((col) => (
                      <td key={col.key}>
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', fontSize: '0.875rem' }}>
        <span style={{ color: 'var(--muted)' }}>
          {sorted.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)}`} of {sorted.length}
        </span>

        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
          <button className="btn btn-secondary" onClick={() => setPage(1)} disabled={safePage === 1} aria-label="First page">«</button>
          <button className="btn btn-secondary" onClick={() => setPage((p) => p - 1)} disabled={safePage === 1} aria-label="Previous page">‹</button>
          <span style={{ padding: '0.4rem 0.75rem', color: 'var(--muted)' }}>
            {safePage} / {totalPages}
          </span>
          <button className="btn btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={safePage === totalPages} aria-label="Next page">›</button>
          <button className="btn btn-secondary" onClick={() => setPage(totalPages)} disabled={safePage === totalPages} aria-label="Last page">»</button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted)' }}>
          Rows:
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            style={{ ...inputStyle, width: 'auto', padding: '0.3rem 0.5rem' }}
          >
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <style jsx>{`
        @media (max-width: 640px) {
          .table-scroll { font-size: 0.8rem; }
        }
      `}</style>
    </div>
  );
}

const inputStyle = {
  padding: '0.45rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: '0.875rem',
  outline: 'none',
  width: '220px',
};

const dropdownStyle = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  right: 0,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  zIndex: 50,
  minWidth: '160px',
  padding: '0.25rem 0',
};
