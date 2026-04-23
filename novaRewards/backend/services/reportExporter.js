/**
 * Converts an array of objects to a CSV string.
 * @param {object[]} rows
 * @returns {string}
 */
function toCSV(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  return lines.join('\n');
}

/**
 * Converts a report object to a minimal plain-text PDF-like format.
 * Returns a Buffer with a simple text-based PDF (no external deps).
 *
 * For production use, swap this with pdfkit or puppeteer.
 *
 * @param {object} report
 * @returns {Buffer}
 */
function toPDF(report) {
  const lines = [
    `Nova Rewards — ${report.type.toUpperCase()} Report`,
    `Generated: ${report.generatedAt}`,
    `Params: ${JSON.stringify(report.params)}`,
    '',
    JSON.stringify(report.data, null, 2),
  ];

  // Minimal valid PDF with embedded text
  const text = lines.join('\n');
  const stream = [
    '%PDF-1.4',
    '1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj',
    '2 0 obj<</Type /Pages /Kids[3 0 R] /Count 1>>endobj',
    `3 0 obj<</Type /Page /Parent 2 0 R /MediaBox[0 0 612 792]`,
    `/Contents 4 0 R /Resources<</Font<</F1 5 0 R>>>>>>endobj`,
    `4 0 obj<</Length ${text.length + 50}>>`,
    'stream',
    'BT /F1 10 Tf 40 750 Td',
    ...text.split('\n').map((l, i) => `(${l.replace(/[()\\]/g, '\\$&')}) Tj 0 -14 Td`),
    'ET',
    'endstream endobj',
    '5 0 obj<</Type /Font /Subtype /Type1 /BaseFont /Courier>>endobj',
    'xref',
    '%%EOF',
  ].join('\n');

  return Buffer.from(stream, 'utf8');
}

/**
 * Flattens a report's data into a row array suitable for CSV export.
 * @param {object} report
 * @returns {object[]}
 */
function flattenReportData(report) {
  const { data, type } = report;
  if (Array.isArray(data)) return data;
  if (type === 'transaction') return data.transactions || [];
  if (type === 'revenue') return data.byMerchant || [];
  if (type === 'user') return [data];
  return [data];
}

module.exports = { toCSV, toPDF, flattenReportData };
