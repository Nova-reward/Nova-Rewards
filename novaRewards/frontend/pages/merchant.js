import { useState, useEffect, useCallback } from 'react';
import CampaignForm from '../components/CampaignForm';
import IssueRewardForm from '../components/IssueRewardForm';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useCampaignStore } from '../store/campaignStore';
import DashboardLayout from '../components/layout/DashboardLayout';
import { 
  PlusCircle, 
  Users, 
  BarChart3, 
  Key, 
  Briefcase, 
  ArrowUpRight, 
  ArrowDownLeft,
  Store,
  FileText
} from 'lucide-react';

/**
 * Merchant dashboard — registration, campaigns, reward issuance, totals.
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */
export default function MerchantDashboard() {
  const { user: merchant, token: apiKey, login } = useAuthStore();
  const { campaigns, setCampaigns } = useCampaignStore();

  // Registration state
  const [regForm, setRegForm] = useState({ name: '', walletAddress: '', businessCategory: '' });
  const [regStatus, setRegStatus] = useState('idle');
  const [regMessage, setRegMessage] = useState('');

  // Dashboard state
  const [totals, setTotals] = useState({ totalDistributed: 0, totalRedeemed: 0 });

  const loadDashboard = useCallback(async (mid) => {
    try {
      const [campRes, totalsRes] = await Promise.all([
        api.get(`/api/campaigns/${mid}`),
        api.get(`/api/transactions/merchant-totals/${mid}`).catch(() => ({ data: { data: { totalDistributed: 0, totalRedeemed: 0 } } })),
      ]);
      setCampaigns(campRes.data.data || []);
      setTotals(totalsRes.data.data || { totalDistributed: 0, totalRedeemed: 0 });
    } catch {
      // silently ignore on first load
    }
  }, [setCampaigns]);

  useEffect(() => {
    if (merchant?.id) loadDashboard(merchant.id);
  }, [merchant, loadDashboard]);

  async function handleRegister(e) {
    e.preventDefault();
    setRegMessage('');
    setRegStatus('loading');
    try {
      const { data } = await api.post('/api/merchants/register', regForm);
      login(data.data, data.data.api_key);
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
        {!merchant && (
           <div className="flex items-center gap-2 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full border border-amber-100 dark:border-amber-900/30">
              <PlusCircle className="w-3.5 h-3.5" />
              Account Registration Required
           </div>
        )}
      </div>

      {!merchant ? (
        <div className="card max-w-xl mx-auto shadow-xl border-violet-100 dark:border-brand-purple/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-violet-50 dark:bg-brand-purple/10 rounded-xl">
              <Store className="w-5 h-5 text-violet-600" />
            </div>
            <h2 className="text-xl font-bold dark:text-white">Register Business</h2>
          </div>
          
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="label">Business Name</label>
              <input className="input" value={regForm.name} onChange={setReg('name')} placeholder="Acme Coffee" disabled={regStatus === 'loading'} required />
            </div>

            <div>
              <label className="label">Stellar Wallet Address</label>
              <input className="input" value={regForm.walletAddress} onChange={setReg('walletAddress')} placeholder="G..." disabled={regStatus === 'loading'} required />
            </div>

            <div>
              <label className="label">Business Category (optional)</label>
              <input className="input" value={regForm.businessCategory} onChange={setReg('businessCategory')} placeholder="Food & Beverage" disabled={regStatus === 'loading'} />
            </div>

            <button className="btn btn-primary w-full py-3 mt-4 flex items-center justify-center gap-2" type="submit" disabled={regStatus === 'loading'}>
              {regStatus === 'loading' ? 'Processing...' : 'Complete Registration'}
              <ArrowUpRight className="w-4 h-4" />
            </button>
            {regMessage && <p className="error text-center">{regMessage}</p>}
          </form>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top Stats & API Key */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card !mb-0 p-8 bg-gradient-to-br from-slate-900 to-brand-dark text-white border-none shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-violet-600/20 rounded-full blur-3xl"></div>
               
               <div className="relative z-10">
                 <div className="flex items-center gap-2 mb-4 opacity-70">
                   <Users className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase tracking-widest">Business Account</span>
                 </div>
                 <h2 className="text-3xl font-bold mb-6 tracking-tight">{merchant.name}</h2>
                 
                 <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 group cursor-pointer hover:bg-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       <span className="flex items-center gap-2"><Key className="w-3 h-3" /> API Credentials</span>
                       <span className="text-emerald-400">Secret</span>
                    </div>
                    <code className="text-violet-300 font-mono text-sm break-all">{apiKey}</code>
                 </div>
                 <p className="mt-4 text-[10px] text-slate-500 font-medium leading-relaxed italic">
                    Note: Authorises reward distributions and campaign management.
                 </p>
               </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="card !mb-0 flex-1 flex flex-col justify-between p-6 bg-violet-50 dark:bg-brand-purple/5 border-violet-100 dark:border-brand-purple/20">
                 <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Distributed</p>
                 <div className="mt-2">
                   <div className="flex items-baseline gap-2">
                     <span className="text-3xl font-extrabold text-violet-600">{parseFloat(totals.totalDistributed).toFixed(0)}</span>
                     <span className="text-sm font-semibold text-slate-400">NOVA</span>
                   </div>
                 </div>
              </div>
              <div className="card !mb-0 flex-1 flex flex-col justify-between p-6 bg-emerald-50 dark:bg-emerald-900/5 border-emerald-100 dark:border-emerald-900/20">
                 <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Redeemed</p>
                 <div className="mt-2">
                   <div className="flex items-baseline gap-2">
                     <span className="text-3xl font-extrabold text-emerald-600">{parseFloat(totals.totalRedeemed).toFixed(0)}</span>
                     <span className="text-sm font-semibold text-slate-400">NOVA</span>
                   </div>
                 </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Issue Rewards Form */}
            <div className="card hover:shadow-lg transition-all border-orange-100 dark:border-orange-900/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                  <Gift className="w-5 h-5 text-orange-600" />
                </div>
                <h2 className="text-xl font-bold dark:text-white">Issue Rewards</h2>
              </div>
              <IssueRewardForm onSuccess={() => loadDashboard(merchant.id)} />
            </div>

            {/* Create Campaign Form */}
            <div className="card hover:shadow-lg transition-all">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-violet-50 dark:bg-brand-purple/10 rounded-xl">
                  <PlusCircle className="w-5 h-5 text-violet-600" />
                </div>
                <h2 className="text-xl font-bold dark:text-white">New Campaign</h2>
              </div>
              <CampaignForm onSuccess={() => loadDashboard(merchant.id)} />
            </div>
          </div>

          {/* Campaign list */}
          <div className="card !mb-12 overflow-hidden px-0 shadow-xl">
            <div className="px-6 flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 dark:bg-brand-border rounded-xl">
                  <BarChart3 className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </div>
                <h2 className="text-xl font-bold dark:text-white">Active Campaigns</h2>
              </div>
              <button className="text-sm font-semibold text-violet-600 hover:scale-105 transition-transform">Download Report</button>
            </div>
            
            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <div className="w-16 h-16 bg-slate-50 dark:bg-brand-border/30 rounded-full flex items-center justify-center mb-4">
                  <Briefcase className="w-6 h-6 text-slate-200" />
                </div>
                <p className="text-slate-400">No campaigns yet. Design your first one above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
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
                        <tr key={c.id} className="group hover:bg-slate-50 dark:hover:bg-brand-border/20 transition-colors">
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-brand-purple/10 flex items-center justify-center">
                                  <FileText className="w-4 h-4 text-violet-600" />
                               </div>
                               <span className="text-sm font-bold dark:text-slate-100">{c.name}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {c.reward_rate} <span className="text-[10px] opacity-60">NOVA / unit</span>
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
  );
}

MerchantDashboard.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};
