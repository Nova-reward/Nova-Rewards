import { useState, useEffect, useCallback } from 'react';
import CampaignManager from '../components/CampaignManager';
import CampaignAnalytics from '../components/CampaignAnalytics';
import IssueRewardForm from '../components/IssueRewardForm';
import api from '../lib/api';

const TABS = ['Campaigns', 'Analytics', 'Issue Rewards'];

/**
 * Merchant dashboard — registration, campaign management, analytics, reward issuance.
 */
export default function MerchantDashboard() {
<<<<<<< main
  const { user: merchant, token: apiKey, login } = useAuthStore();
  const { campaigns, setCampaigns } = useCampaignStore();

  // Registration state
  const [regForm, setRegForm] = useState({
    name: "",
    walletAddress: "",
    businessCategory: "",
  });
=======
  const [regForm, setRegForm] = useState({ name: '', walletAddress: '', businessCategory: '' });
>>>>>>> main
  const [merchant, setMerchant] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [regStatus, setRegStatus] = useState('idle');
  const [regMessage, setRegMessage] = useState('');
  const [totals, setTotals] = useState({ totalDistributed: 0, totalRedeemed: 0 });
  const [activeTab, setActiveTab] = useState('Campaigns');

  const refreshTotals = useCallback(async (mid) => {
    try {
      const res = await api.get(`/api/transactions/merchant-totals/${mid}`);
      setTotals(res.data.data || { totalDistributed: 0, totalRedeemed: 0 });
    } catch {
      // ignore
    }
  }, [setCampaigns]);

  useEffect(() => {
    if (merchant?.id) refreshTotals(merchant.id);
  }, [merchant, refreshTotals]);

  async function handleRegister(e) {
    e.preventDefault();
    setRegMessage('');
    setRegStatus('loading');
    try {
      const { data } = await api.post('/api/merchants/register', regForm);
      setMerchant(data.data);
      setApiKey(data.data.api_key);
      setRegStatus('done');
    } catch (err) {
      setRegStatus('error');
      setRegMessage(err.response?.data?.message || err.message);
    }
  }

  const setReg = (field) => (e) => setRegForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Merchant Portal</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your loyalty campaigns and reward distributions.</p>
        </div>
      </nav>

      <div className="container">
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.8rem', fontWeight: 700 }}>Merchant Portal</h1>

        {!merchant ? (
          <div className="card">
            <h2 style={{ marginBottom: '1rem' }}>Register as a Merchant</h2>
            <form onSubmit={handleRegister}>
              <label className="label">Business Name</label>
              <input className="input" value={regForm.name} onChange={setReg('name')} placeholder="Acme Coffee" disabled={regStatus === 'loading'} />

            <div>
              <label className="label">Stellar Wallet Address</label>
              <input className="input" value={regForm.walletAddress} onChange={setReg('walletAddress')} placeholder="G…" disabled={regStatus === 'loading'} />

            <div>
              <label className="label">Business Category (optional)</label>
              <input className="input" value={regForm.businessCategory} onChange={setReg('businessCategory')} placeholder="Food & Beverage" disabled={regStatus === 'loading'} />

              <button className="btn btn-primary" type="submit" disabled={regStatus === 'loading'}>
                {regStatus === 'loading' ? 'Registering…' : 'Register'}
              </button>
              {regMessage && <p className="error">{regMessage}</p>}
            </form>
          </div>
        ) : (
          <>
            {/* Merchant info */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Logged in as</p>
                  <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{merchant.name}</p>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
                    API Key: <span style={{ color: 'var(--accent)' }}>{apiKey}</span>
                  </p>
                </div>
                {/* Totals */}
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Distributed</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{parseFloat(totals.totalDistributed).toFixed(2)}</p>
                    <p style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>NOVA</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Redeemed</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{parseFloat(totals.totalRedeemed).toFixed(2)}</p>
                    <p style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>NOVA</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

<<<<<<< main
            {/* Issue rewards — Requirements 10.4 */}
            <div className="card">
              <h2 style={{ marginBottom: "1rem" }}>Issue Rewards</h2>
              <IssueRewardForm
                merchantId={merchant.id}
                apiKey={apiKey}
                campaigns={campaigns}
                onSuccess={() => getMerchantTotals(merchant.id)}
              />
            </div>

            {/* Create campaign — Requirements 10.3 */}
            <div className="card">
              <h2 style={{ marginBottom: "1rem" }}>Create Campaign</h2>
              <CampaignForm
                onSuccess={() => loadDashboard(merchant.id)}
              />
=======
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '0.6rem 1.2rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                    color: activeTab === tab ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: activeTab === tab ? 700 : 400,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    marginBottom: '-1px',
                  }}
                >
                  {tab}
                </button>
              ))}
>>>>>>> main
            </div>
          </div>

            {/* Campaign list — Requirements 10.1 */}
            <div className="card">
              <h2 style={{ marginBottom: "1rem" }}>Campaigns</h2>
              {campaigns.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>
                  No campaigns yet. Create one above.
                </p>
              ) : (
                <table>
                  <thead>
                    <tr className="bg-slate-50 dark:bg-brand-border/30">
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-none">Name</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-none">Rate</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-none">Duration</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-none text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-brand-border/40">
                    {campaigns.map((c) => {
                      const expired = new Date(c.end_date) < new Date();
                      const isActive = c.is_active && !expired;
                      return (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td>{c.reward_rate} NOVA/unit</td>
                          <td>{c.start_date?.slice(0, 10)}</td>
                          <td>{c.end_date?.slice(0, 10)}</td>
                          <td>
                            <span
                              className={`badge ${c.is_active && !expired ? "badge-green" : "badge-gray"}`}
                            >
                              {c.is_active && !expired ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                               <span className="text-xs font-medium dark:text-slate-200">{c.start_date?.slice(0, 10)}</span>
                               <span className="text-[10px] text-slate-400">to {c.end_date?.slice(0, 10)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                               isActive 
                                 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                                 : 'bg-slate-100 dark:bg-brand-border text-slate-500 dark:text-slate-400'
                             }`}>
                                {isActive ? (
                                  <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                    Active
                                  </>
                                ) : 'Inactive'}
                             </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
            {/* Tab content */}
            {activeTab === 'Campaigns' && (
              <div className="card">
                <h2 style={{ marginBottom: '1rem' }}>Campaign Management</h2>
                <CampaignManager
                  merchantId={merchant.id}
                  apiKey={apiKey}
                  onUpdate={() => refreshTotals(merchant.id)}
                />
              </div>
            )}

            {activeTab === 'Analytics' && (
              <CampaignAnalytics merchantId={merchant.id} apiKey={apiKey} />
            )}

            {activeTab === 'Issue Rewards' && (
              <div className="card">
                <h2 style={{ marginBottom: '1rem' }}>Issue Rewards</h2>
                <IssueRewardForm
                  merchantId={merchant.id}
                  apiKey={apiKey}
                  onSuccess={() => refreshTotals(merchant.id)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

MerchantDashboard.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};
