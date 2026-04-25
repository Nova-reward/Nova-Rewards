import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useWallet } from "../context/WalletContext";
import { useUser, useCampaigns, useBalance, useTransactions } from "../lib/useApi";
import DashboardLayout from "../components/DashboardLayout";
import TrustlineButton from "../components/TrustlineButton";
import TransferForm from "../components/TransferForm";
import RedeemForm from "../components/RedeemForm";
import ReferralLink from "../components/ReferralLink";
import { SkeletonDashboard } from "../components/Skeleton";
import ErrorBoundary from "../components/ErrorBoundary";
import WalletGuard from "../components/WalletGuard";
import WalletConnect from "../components/WalletConnect";
import { truncateAddress } from "../lib/truncateAddress";

// Heavy components — loaded only when the dashboard is rendered client-side
const StellarDropModal = dynamic(() => import("../components/StellarDropModal"), { ssr: false });

/**
 * Customer dashboard — balance, transaction history, trustline, transfer, redeem.
 * Requirements: 9.1, 9.2, 9.3, 8.5
 */
function DashboardContent() {
  const {
    publicKey,
    balance,
    transactions,
    connect,
    disconnect,
    refreshBalance,
    freighterInstalled,
    loading,
    error: walletError,
  } = useWallet();
  const router = useRouter();
  const dropModalRef = useRef(null);

  // Assume userId is stored in localStorage or from auth
  const userId = localStorage.getItem('userId');

  // SWR hooks for data fetching
  const { data: user, error: userError, isLoading: userLoading } = useUser(userId);
  const { data: campaigns, error: campaignsError, isLoading: campaignsLoading } = useCampaigns();
  const { data: userBalance, error: balanceError, isLoading: balanceLoading } = useBalance(userId);
  const { data: recentTransactions, error: txError, isLoading: txLoading } = useTransactions(userId, { limit: 10 });

  useEffect(() => {
    if (!loading && !publicKey) router.push("/");
  }, [publicKey, loading, router]);

  // Check for eligible drops when dashboard loads
  useEffect(() => {
    if (publicKey && !loading) {
      // Trigger the drop modal's eligibility check
      if (dropModalRef.current) {
        dropModalRef.current.checkEligibility();
      }
    }
  }, [publicKey, loading]);

  if (!publicKey) return null;

  const shortKey = truncateAddress(publicKey);

  function formatTx(tx) {
    const isIncoming = tx.to === publicKey || tx.to_account === publicKey;
    const counterparty = isIncoming
      ? (tx.from || tx.from_account || "").slice(0, 8) + "…"
      : (tx.to || tx.to_account || "").slice(0, 8) + "…";
    const type = isIncoming ? "↓ Received" : "↑ Sent";
    const date = tx.created_at
      ? new Date(tx.created_at).toLocaleDateString()
      : "—";
    return { type, counterparty, amount: tx.amount, date };
  }

  // Handle successful drop claim
  const handleDropClaimSuccess = (claimedAmount) => {
    // Refresh the balance to show the new tokens
    refreshBalance();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Wallet connection section */}
        <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 md:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold dark:text-white">Wallet</h2>
              {publicKey && (
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">
                  {publicKey}
                </p>
              )}
            </div>
            <WalletConnect />
          </div>
          {walletError && (
            <p className="mt-3 text-sm text-red-500">{walletError}</p>
          )}
        </div>

        {userLoading || campaignsLoading || balanceLoading ? (
          <SkeletonDashboard />
        ) : (
          <>
            {/* Summary grid — 1 col mobile, 2 col md, 3 col lg */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Balance cards per campaign */}
              {userBalance && campaigns ? (
                Object.entries(userBalance).map(([campaignId, amount]) => {
                  const campaign = campaigns.find(c => c.id === campaignId);
                  return (
                    <div key={campaignId} className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 shadow-sm text-center">
                      <p className="text-slate-400 text-sm mb-1">{campaign?.name || 'Unknown Campaign'} Balance</p>
                      <p className="text-3xl font-extrabold text-brand-purple">{parseFloat(amount).toFixed(2)}</p>
                      <p className="text-slate-400 text-xs mt-1">{campaign?.tokenSymbol || 'TOKEN'}</p>
                      <div className="mt-2 w-full bg-slate-200 dark:bg-brand-border rounded h-2">
                        <div
                          className="bg-brand-purple h-2 rounded"
                          style={{ width: `${Math.min((amount / (campaign?.totalSupply || 1000)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 shadow-sm text-center">
                  <p className="text-slate-400 text-sm mb-1">No balances yet</p>
                  <p className="text-xl text-brand-purple">Start earning rewards!</p>
                </div>
              )}

              {/* Active campaigns */}
              <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 shadow-sm">
                <h2 className="font-bold text-base dark:text-white mb-3">Active Campaigns</h2>
                {campaigns && campaigns.length > 0 ? (
                  <ul className="divide-y divide-slate-100 dark:divide-brand-border">
                    {campaigns.slice(0, 5).map(campaign => (
                      <li key={campaign.id} className="py-2">
                        <p className="font-semibold text-sm dark:text-white">{campaign.name}</p>
                        <p className="text-xs text-slate-400">{campaign.description}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400 text-sm">No active campaigns</p>
                )}
              </div>

              {/* Recent transactions */}
              <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 shadow-sm">
                <h2 className="font-bold text-base dark:text-white mb-3">Recent Transactions</h2>
                {txLoading ? (
                  <p className="text-sm text-slate-400">Loading…</p>
                ) : recentTransactions && recentTransactions.length > 0 ? (
                  <ul className="divide-y divide-slate-100 dark:divide-brand-border">
                    {recentTransactions.map((tx, i) => (
                      <li key={tx.id || i} className="py-2 flex justify-between items-start gap-2">
                        <div>
                          <p className="font-semibold text-sm dark:text-white">{tx.type}</p>
                          <p className="text-xs text-slate-400">{tx.amount} {tx.campaign?.tokenSymbol || 'TOKEN'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</p>
                          <span className={`text-xs font-semibold ${tx.status === 'confirmed' ? 'text-green-500' : 'text-yellow-500'}`}>{tx.status}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-slate-400 text-sm mb-2">No transactions yet.</p>
                    <a href="/merchant" className="text-brand-purple font-semibold text-sm">Browse merchants →</a>
                  </div>
                )}
              </div>
            </div>

            {/* Trustline */}
            <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 md:p-6 shadow-sm">
              <h2 className="font-bold text-base dark:text-white mb-3">Trustline</h2>
              <TrustlineButton walletAddress={publicKey} onSuccess={() => refreshBalance()} />
            </div>

            <ReferralLink userId={publicKey} />

            {/* Transfer */}
            <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 md:p-6 shadow-sm">
              <h2 className="font-bold text-base dark:text-white mb-3">Send NOVA</h2>
              <TransferForm senderPublicKey={publicKey} senderBalance={balance} onSuccess={() => refreshBalance()} />
            </div>

            {/* Redeem */}
            <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 md:p-6 shadow-sm">
              <h2 className="font-bold text-base dark:text-white mb-3">Redeem NOVA</h2>
              <RedeemForm senderPublicKey={publicKey} senderBalance={balance} onSuccess={() => refreshBalance()} />
            </div>
          </>
        )}
      </div>

      <StellarDropModal ref={dropModalRef} onClaimSuccess={handleDropClaimSuccess} />
    </DashboardLayout>
  );
}

export default function Dashboard() {
  return (
    <ErrorBoundary>
      <WalletGuard>
        <DashboardContent />
      </WalletGuard>
    </ErrorBoundary>
  );
}

Dashboard.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};
