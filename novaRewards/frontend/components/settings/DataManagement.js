'use client';

import { useState } from 'react';

/**
 * Data management: export user data as JSON or CSV.
 */
export default function DataManagement() {
  const [exporting, setExporting] = useState(null);
  const [exportMsg, setExportMsg] = useState(null);

  const handleExport = async (format) => {
    setExporting(format);
    setExportMsg(null);

    try {
      // TODO: wire to API — GET /users/export?format=json|csv
      // Simulated export with mock data
      await new Promise((r) => setTimeout(r, 800));

      const mockData = {
        exportedAt: new Date().toISOString(),
        profile: { name: 'User', email: 'user@example.com' },
        transactions: [],
        rewards: [],
      };

      let blob, filename;
      if (format === 'json') {
        blob = new Blob([JSON.stringify(mockData, null, 2)], { type: 'application/json' });
        filename = 'nova-rewards-data.json';
      } else {
        const csv = 'field,value\nexportedAt,' + mockData.exportedAt;
        blob = new Blob([csv], { type: 'text/csv' });
        filename = 'nova-rewards-data.csv';
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setExportMsg({ type: 'success', text: `Data exported as ${format.toUpperCase()} successfully.` });
    } catch {
      setExportMsg({ type: 'error', text: 'Export failed. Please try again.' });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <h3 className="settings-section-title">Data Management</h3>

      <div className="settings-subsection">
        <h4 className="settings-subsection-title">Export Your Data</h4>
        <p className="settings-row-desc" style={{ marginBottom: '1rem' }}>
          Download a copy of your Nova Rewards data including your profile, transaction history, and earned rewards.
        </p>
        <div className="data-export-actions">
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('json')}
            disabled={!!exporting}
            aria-label="Export data as JSON"
          >
            {exporting === 'json' ? '⏳ Exporting…' : '⬇️ Export as JSON'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('csv')}
            disabled={!!exporting}
            aria-label="Export data as CSV"
          >
            {exporting === 'csv' ? '⏳ Exporting…' : '⬇️ Export as CSV'}
          </button>
        </div>
        {exportMsg && (
          <p className={exportMsg.type === 'error' ? 'error' : 'success'} style={{ marginTop: '0.75rem' }}>
            {exportMsg.text}
          </p>
        )}
      </div>

      <div className="settings-subsection">
        <h4 className="settings-subsection-title" style={{ color: 'var(--error)' }}>Danger Zone</h4>
        <p className="settings-row-desc" style={{ marginBottom: '1rem' }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          className="btn btn-danger"
          onClick={() => window.confirm('Are you sure? This cannot be undone.') && alert('Account deletion request submitted.')}
          aria-label="Delete account"
        >
          🗑️ Delete Account
        </button>
      </div>
    </div>
  );
}
