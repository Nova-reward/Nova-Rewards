import { useEffect } from "react";
import { useRouter } from "next/router";
import { useWallet } from "../context/WalletContext";
import TrustlineButton from "../components/TrustlineButton";
import TransferForm from "../components/TransferForm";
import RedeemForm from "../components/RedeemForm";

/**
 * Customer dashboard — balance, transaction history, trustline, transfer, redeem.
 * Requirements: 9.1, 9.2, 9.3, 8.5
 */
export default function Dashboard() {
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

  const shortKey = `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}`;

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
          <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
            {shortKey}
          </span>
          <button
            className="btn btn-secondary"
            onClick={disconnect}
            style={{ padding: "0.4rem 1rem" }}
          >
            Disconnect
          </button>
        </div>
      </nav>

      <div className="container">
        <div className="dashboard-summary-grid">
          {/* Balance card */}
          <div className="card" style={{ textAlign: "center" }}>
            <p style={{ color: "#94a3b8", marginBottom: "0.4rem" }}>
              NOVA Balance
            </p>
            <p style={{ fontSize: "3rem", fontWeight: 800, color: "#7c3aed" }}>
              {parseFloat(balance).toFixed(2)}
            </p>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>NOVA</p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: "1rem" }}
              onClick={() => refreshBalance()}
            >
              Refresh
            </button>
          </div>

          {/* Transaction history */}
          <div className="card">
            <h2 style={{ marginBottom: "1rem" }}>Transaction History</h2>
            {transactions.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>No NOVA transactions yet.</p>
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
                          <td>{parseFloat(amount).toFixed(4)} NOVA</td>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.85rem",
                            }}
                          >
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
          <h2 style={{ marginBottom: "1rem" }}>Trustline</h2>
          <TrustlineButton
            walletAddress={publicKey}
            onSuccess={() => refreshBalance()}
          />
        </div>

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
      </div>
    </>
  );
}
