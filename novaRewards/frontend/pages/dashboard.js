import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWalletStore } from '../store/walletStore';

import TrustlineButton from '../components/TrustlineButton';
import TransferForm from '../components/TransferForm';
import RedeemForm from '../components/RedeemForm';
import DashboardLayout from '../components/layout/DashboardLayout';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, History, ShieldCheck, Send, ShoppingBag } from 'lucide-react';

/**
 * Customer dashboard — balance, transaction history, trustline, transfer, redeem.
 * Requirements: 9.1, 9.2, 9.3, 8.5
 */
export default function Dashboard() {
  const { publicKey, balance, transactions, refreshBalance, isLoading } = useWalletStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !publicKey) router.push('/');
  }, [publicKey, isLoading, router]);

  if (!publicKey) return null;

  function formatTx(tx) {
    const isIncoming = tx.to === publicKey || tx.to_account === publicKey;
    const counterparty = isIncoming
      ? (tx.from || tx.from_account || '').slice(0, 8) + '…'
      : (tx.to || tx.to_account || '').slice(0, 8) + '…';
    const type = isIncoming ? 'Received' : 'Sent';
    const date = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—';
    return { type, counterparty, amount: tx.amount, date, isIncoming };
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your NOVA tokens and rewards.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-100 dark:bg-brand-border/50 px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          Stellar Testnet Connected
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Balance Card - Main Highlight */}
        <div className="lg:col-span-2 relative overflow-hidden group rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-white shadow-2xl shadow-violet-600/20">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors duration-500"></div>
          
          <div className="relative z-10 flex flex-col h-full justify-between gap-8">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-violet-100 uppercase tracking-widest">Available Balance</span>
              <button 
                onClick={() => refreshBalance()}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-md"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-extrabold tracking-tighter">
                  {parseFloat(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-2xl font-semibold opacity-80">NOVA</span>
              </div>
              <p className="text-xs text-violet-200 mt-2 font-mono opacity-60">Issuer: {process.env.NEXT_PUBLIC_ISSUER_PUBLIC?.slice(0, 8)}...</p>
            </div>

            <div className="flex items-center gap-4 pt-4 mt-2 border-t border-white/10">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-violet-200 opacity-60">Status</span>
                <span className="text-sm font-semibold">Active Vault</span>
              </div>
              <div className="h-8 w-px bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-violet-200 opacity-60">Network</span>
                <span className="text-sm font-semibold">Mainnet Beta</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Quick Links / Trustline */}
        <div className="flex flex-col gap-4">
           <div className="card p-6 flex flex-col gap-4 !mb-0 border-violet-100 dark:border-brand-purple/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-violet-100 dark:bg-brand-purple/10 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-violet-600" />
                </div>
                <h2 className="text-lg font-bold dark:text-white">Security</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                Ensure your wallet is authorised to receive NOVA tokens.
              </p>
              <TrustlineButton onSuccess={() => refreshBalance()} />
           </div>

           <div className="bg-slate-900 rounded-2xl p-6 text-white flex items-center justify-between group cursor-pointer hover:bg-slate-800 transition-colors">
              <div>
                <h3 className="text-sm font-semibold">Need Help?</h3>
                <p className="text-xs text-slate-400 mt-1">View the user guide</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-violet-600 transition-colors">
                 <ArrowUpRight className="w-4 h-4" />
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Transfer */}
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold dark:text-white">Send Tokens</h2>
          </div>
          <TransferForm onSuccess={() => refreshBalance()} />
        </div>

        {/* Redeem */}
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold dark:text-white">Redeem Rewards</h2>
          </div>
          <RedeemForm onSuccess={() => refreshBalance()} />
        </div>
      </div>

      {/* Transaction history */}
      <div className="card !mb-12 overflow-hidden px-0">
        <div className="px-6 flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 dark:bg-brand-border rounded-xl">
              <History className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <h2 className="text-xl font-bold dark:text-white">Activity</h2>
          </div>
          <button className="text-sm font-semibold text-violet-600 hover:text-violet-500">View All</button>
        </div>
        
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-16 h-16 bg-slate-50 dark:bg-brand-border/30 rounded-full flex items-center justify-center mb-4">
              <History className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-slate-400">No NOVA transactions yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-brand-border/30">
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-none">Transaction</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-none">Amount</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-none">Address</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-none">Date</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-none text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-brand-border/40">
                {transactions.map((tx, i) => {
                  const { type, counterparty, amount, date, isIncoming } = formatTx(tx);
                  return (
                    <tr key={tx.id || i} className="group hover:bg-slate-50 dark:hover:bg-brand-border/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isIncoming ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-orange-50 text-orange-600 dark:bg-orange-900/20'}`}>
                            {isIncoming ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold dark:text-slate-100">{type}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Legacy TX</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${isIncoming ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-100'}`}>
                          {isIncoming ? '+' : '-'}{parseFloat(amount).toFixed(2)} <span className="text-xs font-medium opacity-60">NOVA</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-brand-border px-2 py-1 rounded-md">{counterparty}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">{date}</td>
                      <td className="px-6 py-4 text-right">
                         <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                            Success
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
  );
}

Dashboard.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};
