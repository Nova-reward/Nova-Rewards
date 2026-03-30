import { useWalletStore } from '../store/walletStore';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rocket, Shield, Zap, ArrowRight, Wallet } from 'lucide-react';
import ThemeToggle from '../components/layout/ThemeToggle';

export default function Home() {
  const { publicKey, connect, loading, error, freighterInstalled, disconnect } = useWallet();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (publicKey) router.push('/dashboard');
  }, [publicKey, router]);

  const handleDisconnect = () => {
    disconnect();
    router.push('/');
  };

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">⭐ NovaRewards</span>
        <div className="nav-links">
          <a href="/merchant">Merchant Portal</a>
          <a href="/auth/register">Email Sign Up</a>
          <a href="/auth/login">Email Login</a>
          {publicKey && (
            <button
              className="btn btn-secondary"
              onClick={handleDisconnect}
              style={{ padding: "0.4rem 1rem" }}
            >
              Disconnect
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-20 pb-32 px-6 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 opacity-30 dark:opacity-20 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-400 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-blue-400 rounded-full blur-[120px] animate-pulse delay-700"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-4 duration-1000">
             <Zap className="w-3 h-3 fill-current" />
             Next-Gen Loyalty Platform
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-4 duration-700">
            Ownership Your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-500">Loyalty Rewards</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-1000">
            NovaRewards puts loyalty tokens on the Stellar blockchain. Earn, transfer, and redeem NOVA tokens across any participating merchant with absolute transparency.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {freighterInstalled === false ? (
              <a
                href="https://www.freighter.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full sm:w-auto px-8 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-900/20"
              >
                Install Freighter Wallet
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            ) : (
              <button
                onClick={connect}
                disabled={isLoading}
                className="group w-full sm:w-auto px-8 py-4 bg-violet-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-violet-500 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-violet-600/30 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isLoading ? 'Connecting...' : (
                  <>
                    <Wallet className="w-5 h-5" />
                    Connect Freighter Wallet
                  </>
                )}
              </button>
            )}
            
            <Link 
              href="/merchant"
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-brand-border/30 dark:text-white dark:border-brand-border/50 text-slate-900 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-brand-border/50 hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              For Business
            </Link>
          </div>

          {error && (
            <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900/30 animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}
        </div>

        {/* Feature Grid */}
        <div className="max-w-6xl mx-auto mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 px-4 relative z-10">
          <div className="p-8 rounded-3xl bg-white dark:bg-brand-card/50 border dark:border-brand-border/50 hover:shadow-2xl hover:shadow-violet-600/5 transition-all group">
            <div className="w-14 h-14 bg-violet-100 dark:bg-brand-purple/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
               <Shield className="w-6 h-6 text-violet-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Secure & Immutable</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Every transaction is recorded on the Stellar Ledger, ensuring your rewards are safe and uniquely yours.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white dark:bg-brand-card/50 border dark:border-brand-border/50 hover:shadow-2xl hover:shadow-blue-600/5 transition-all group">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
               <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Instant Redemptions</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              No more waiting for points to clear. Redeem your NOVA tokens instantly at any participating merchant.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white dark:bg-brand-card/50 border dark:border-brand-border/50 hover:shadow-2xl hover:shadow-emerald-600/5 transition-all group">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
               <Rocket className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Peer-to-Peer</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Send tokens to friends or family. Your rewards are as liquid as any other digital asset.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 px-12 border-t dark:border-brand-border/50 text-center text-slate-400 dark:text-slate-500 text-sm transition-colors">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-lg">⭐</span>
          <span className="font-bold text-slate-800 dark:text-white">NovaRewards</span>
        </div>
        <p>© 2026 NovaRewards. Built on Stellar.</p>
      </footer>
    </div>
  );
}
