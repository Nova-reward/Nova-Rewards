import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useWallet } from "../context/WalletContext";
import { useUser, useCampaigns, useBalance } from "../lib/useApi";
import DashboardLayout from "../components/DashboardLayout";
import TrustlineButton from "../components/TrustlineButton";
import TransferForm from "../components/TransferForm";
import RedeemForm from "../components/RedeemForm";
import ReferralLink from "../components/ReferralLink";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ErrorBoundary from "../components/ErrorBoundary";
import StellarDropModal from "../components/StellarDropModal";
import WalletConnect from "../components/WalletConnect";
import { truncateAddress } from "../lib/truncateAddress";

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
      <div className="dashboard-content">
        {/* Wallet connection section */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ marginBottom: '0.25rem' }}>Wallet</h2>
              {publicKey && (
                <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  {publicKey}
                </p>
              )}
            </div>
            <WalletConnect />
          </div>
          {walletError && (
            <p className="error" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{walletError}</p>
          )}
        </div>

        {userLoading || campaignsLoading || balanceLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <div className="dashboard-summary-grid">
              {/* Balance cards per campaign */}
              {userBalance && campaigns ? (
                Object.entries(userBalance).map(([campaignId, amount]) => {
                  const campaign = campaigns.find(c => c.id === campaignId);
                  return (
                    <div key={campaignId} className="card" style={{ textAlign: "center" }}>
                      <p style={{ color: "#94a3b8", marginBottom: "0.4rem" }}>
                        {campaign?.name || 'Unknown Campaign'} Balance
                      </p>
                      <p style={{ fontSize: "2rem", fontWeight: 800, color: "#7c3aed" }}>
                        {parseFloat(amount).toFixed(2)}
                      </p>
                      <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{campaign?.tokenSymbol || 'TOKEN'}</p>
                      <div style={{ marginTop: "0.5rem", width: "100%", background: "#e5e7eb", borderRadius: "4px", height: "8px" }}>
                        <div style={{ width: `${Math.min((amount / (campaign?.totalSupply || 1000)) * 100, 100)}%`, background: "#7c3aed", height: "100%", borderRadius: "4px" }}></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="card" style={{ textAlign: "center" }}>
                  <p style={{ color: "#94a3b8", marginBottom: "0.4rem" }}>
                    No balances yet
                  </p>
                  <p style={{ fontSize: "1.5rem", color: "#7c3aed" }}>
                    Start earning rewards!
                  </p>
                </div>
              )}

              {/* Active campaigns */}
              <div className="card">
                <h2 style={{ marginBottom: "1rem" }}>Active Campaigns</h2>
                {campaigns && campaigns.length > 0 ? (
                  <div>
                    {campaigns.slice(0, 5).map(campaign => (
                      <div key={campaign.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #e5e7eb" }}>
                        <p style={{ fontWeight: 600 }}>{campaign.name}</p>
                        <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{campaign.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "#94a3b8" }}>No active campaigns</p>
                )}
              </div>

              {/* Recent transactions */}
              <div className="card">
                <h2 style={{ marginBottom: "1rem" }}>Recent Transactions</h2>
                {txLoading ? (
                  <p>Loading...</p>
                ) : recentTransactions && recentTransactions.length > 0 ? (
                  <div>
                    {recentTransactions.map((tx, i) => (
                      <div key={tx.id || i} style={{ padding: "0.5rem 0", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ fontWeight: 600 }}>{tx.type}</p>
                          <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{tx.amount} {tx.campaign?.tokenSymbol || 'TOKEN'}</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: "0.85rem" }}>{new Date(tx.createdAt).toLocaleDateString()}</p>
                          <span className={`badge ${tx.status === 'confirmed' ? 'success' : 'pending'}`}>{tx.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "1rem 0" }}>
                    <p style={{ color: "#94a3b8", marginBottom: "0.75rem" }}>
                      No transactions yet. Start earning rewards!
                    </p>
                    <a href="/merchant" style={{ color: "#7c3aed", fontWeight: 600 }}>
                      Browse merchants →
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: "1rem" }}>Trustline</h2>
              <TrustlineButton
                walletAddress={publicKey}
                onSuccess={() => refreshBalance()}
              />
            </div>

            {/* Referral Link — Requirement 168 */}
            <ReferralLink userId={publicKey} />


            {/* Transfer */}
            <div className="card">
              <h2 style={{ marginBottom: "1rem" }}>Send NOVA</h2>
              <TransferForm
                senderPublicKey={publicKey}
                senderBalance={balance}
                onSuccess={() => refreshBalance()}
              />
            </div>

            {/* Redeem */}
            <div className="card">
              <h2 style={{ marginBottom: "1rem" }}>Redeem NOVA</h2>
              <RedeemForm
                senderPublicKey={publicKey}
                senderBalance={balance}
                onSuccess={() => refreshBalance()}
              />
            </div>
          </>
        )}
      </div>
      
      {/* Stellar Drop Modal */}
      <StellarDropModal 
        ref={dropModalRef}
        onClaimSuccess={handleDropClaimSuccess}
      />
    </DashboardLayout>
  );
}

export default function Dashboard() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}

Dashboard.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};
