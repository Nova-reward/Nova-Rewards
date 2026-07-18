/**
 * Converts an array of objects to a CSV string and triggers a download.
 * @param {object[]} rows
 * @param {string} filename
 */
export function exportCSV(rows, filename = 'analytics.csv') {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
  ].join('\n');
  download(new Blob([csv], { type: 'text/csv' }), filename);
}

/**
 * Exports all analytics sections as a multi-section CSV.
 * @param {object} data  Full analytics data object
 * @param {string} range Date range label
 */
export function exportAnalyticsReport(data, range) {
  if (!data) return;
  const sections = [
    `Nova Rewards Analytics Report — Range: ${range}`,
    '',
    '## Summary',
    'Metric,Value,Change',
    ...Object.entries(data.summary).map(
      ([k, v]) => `${k},${v.value},${v.change > 0 ? '+' : ''}${v.change}%`
    ),
    '',
    '## Growth Trends',
    Object.keys(data.growth[0] ?? {}).join(','),
    ...data.growth.map((r) => Object.values(r).join(',')),
    '',
    '## Engagement',
    Object.keys(data.engagement[0] ?? {}).join(','),
    ...data.engagement.map((r) => Object.values(r).join(',')),
    '',
    '## Campaign Performance',
    Object.keys(data.campaigns[0] ?? {}).join(','),
    ...data.campaigns.map((r) => Object.values(r).join(',')),
    '',
    '## Reward Distribution',
    'name,value',
    ...data.distribution.map((r) => `${r.name},${r.value}`),
  ].join('\n');

  download(new Blob([sections], { type: 'text/csv' }), `nova-analytics-${range}.csv`);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
