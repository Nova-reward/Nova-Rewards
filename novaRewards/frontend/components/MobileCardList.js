/**
 * MobileCardList — renders tabular data as stacked cards on mobile,
 * and falls back to a standard <table> on md+ screens.
 *
 * Props:
 *   columns: [{ key: string, label: string, render?: (value, row) => ReactNode }]
 *   data:    array of row objects
 *   keyField?: string — field to use as React key (default: 'id')
 *   emptyMessage?: string
 */
export default function MobileCardList({
  columns = [],
  data = [],
  keyField = 'id',
  emptyMessage = 'No data available.',
}) {
  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      {/* ── Mobile: card list (< md) ─────────────────────────────────────── */}
      <ul className="space-y-3 md:hidden" role="list">
        {data.map((row, i) => (
          <li
            key={row[keyField] ?? i}
            className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 shadow-sm"
          >
            {columns.map(({ key, label, render }) => {
              const value = row[key];
              return (
                <div key={key} className="flex items-start justify-between py-1 text-sm">
                  <span className="font-semibold uppercase tracking-wide text-xs text-slate-400 dark:text-slate-500 w-1/3 shrink-0">
                    {label}
                  </span>
                  <span className="text-right text-slate-800 dark:text-slate-200 break-all">
                    {render ? render(value, row) : (value ?? '—')}
                  </span>
                </div>
              );
            })}
          </li>
        ))}
      </ul>

      {/* ── Desktop: standard table (≥ md) ──────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-brand-border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-brand-card text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wide">
            <tr>
              {columns.map(({ key, label }) => (
                <th key={key} className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-brand-border">
            {data.map((row, i) => (
              <tr
                key={row[keyField] ?? i}
                className="bg-white dark:bg-brand-card hover:bg-slate-50 dark:hover:bg-brand-border/30 transition-colors"
              >
                {columns.map(({ key, render }) => (
                  <td key={key} className="px-4 py-3 text-slate-800 dark:text-slate-200">
                    {render ? render(row[key], row) : (row[key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
