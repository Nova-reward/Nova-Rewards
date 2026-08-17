import { useEffect } from "react";
import { useRouter } from "next/router";
import { useWallet } from "../context/WalletContext";
import TrustlineButton from "../components/TrustlineButton";
import TransferForm from "../components/TransferForm";
import RedeemForm from "../components/RedeemForm";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ErrorBoundary from "../components/ErrorBoundary";
import Navbar from "../components/Navbar";
import { truncateAddress } from "../lib/truncateAddress";
import { formatTokenAmount } from "../lib/formatting";

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
  } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !publicKey) router.push("/");
  }, [publicKey, loading, router]);

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

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">⭐ NovaRewards</span>
        <div className="nav-links">
          <span className="text-neutral-400 text-sm">
            {shortKey}
          </span>
          <a href="/monitoring" className="text-sm">Monitoring</a>
          <button
            className="btn btn-secondary px-4 py-1.5"
            onClick={disconnect}
          >
            Disconnect
          </button>
        </div>
      </nav>

      <div className="container">
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <div className="dashboard-summary-grid">
              {/* Balance card */}
              <div className="card text-center">
                <p className="text-neutral-400 mb-1.5">
                  NOVA Balance
                </p>
                <p className="text-5xl font-extrabold text-primary-600">
                  {formatTokenAmount(balance)}
                </p>
                <p className="text-neutral-400 text-sm">NOVA</p>
                <button
                  className="btn btn-secondary mt-4"
                  onClick={() => refreshBalance()}
                >
                  Refresh
                </button>
              </div>

              {/* Transaction history */}
              <div className="card">
                <h2 className="mb-4">Transaction History</h2>
                {transactions.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-neutral-400 mb-3">
                      No transactions yet. Start earning NOVA rewards!
                    </p>
                    <a href="/merchant" className="text-primary-600 font-semibold">
                      Browse merchants →
                    </a>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Counterparty</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx, i) => {
                          const { type, counterparty, amount, date } = formatTx(tx);
                          return (
                            <tr key={tx.id || i}>
                              <td>{type}</td>
                              <td>{formatTokenAmount(amount)} NOVA</td>
                              <td className="font-mono text-sm">
                                {counterparty}
                              </td>
                              <td>{date}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Trustline */}
            <div className="card">
              <h2 className="mb-4">Trustline</h2>
              <TrustlineButton
                walletAddress={publicKey}
                onSuccess={() => refreshBalance()}
              />
            </div>

            {/* Transfer */}
            <div className="card">
              <h2 className="mb-4">Send NOVA</h2>
              <TransferForm
                senderPublicKey={publicKey}
                senderBalance={balance}
                onSuccess={() => refreshBalance()}
              />
            </div>

            {/* Redeem */}
            <div className="card">
              <h2 className="mb-4">Redeem NOVA</h2>
              <RedeemForm
                senderPublicKey={publicKey}
                senderBalance={balance}
                onSuccess={() => refreshBalance()}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}

export default function Dashboard() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}
