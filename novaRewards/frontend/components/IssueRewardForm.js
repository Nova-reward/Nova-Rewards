"use client";
import { useState } from "react";
import { StrKey } from "stellar-sdk";
import api from "../lib/api";

/**
 * Form for issuing NOVA rewards to a customer wallet.
 * Requirements: 10.4, 10.5, 3.1
 */
export default function IssueRewardForm({
  merchantId,
  apiKey,
  campaigns,
  onSuccess,
}) {
  const [customerWallet, setCustomerWallet] = useState("");
  const [amount, setAmount] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState("");
  const [walletError, setWalletError] = useState("");

  function isValidAddress(addr) {
    try {
      return StrKey.isValidEd25519PublicKey(addr);
    } catch {
      return false;
    }
  }

  async function handleIssue(e) {
    e.preventDefault();
    setMessage("");
    setTxHash("");
    setWalletError("");

    const trimmedWallet = customerWallet.trim();

    // Client-side validation — Requirements 10.5
    if (!isValidAddress(trimmedWallet)) {
      setWalletError("Please enter a valid Stellar public key (G...).");
      setMessage("Customer wallet must be a valid Stellar public key.");
      setStatus("error");
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setMessage("Amount must be a positive number.");
      setStatus("error");
      return;
    }
    if (!campaignId) {
      setMessage("Please select a campaign.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      const { data } = await api.post(
        "/api/rewards/distribute",
        {
          customerWallet: trimmedWallet,
          amount,
          campaignId: Number(campaignId),
        },
        { headers: { "x-api-key": apiKey } },
      );
      setStatus("done");
      setTxHash(data.data.txHash);
      setMessage("Rewards issued successfully.");
      setCustomerWallet("");
      setAmount("");
      await onSuccess?.();
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || err.message);
    }
  }

  const activeCampaigns = campaigns.filter((c) => c.is_active);

  return (
    <form onSubmit={handleIssue}>
      <label className="label">Campaign</label>
      <select
        className="input"
        value={campaignId}
        onChange={(e) => setCampaignId(e.target.value)}
        disabled={status === "loading"}
      >
        <option value="">Select a campaign…</option>
        {activeCampaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.reward_rate} NOVA/unit)
          </option>
        ))}
      </select>

      <label className="label">Customer Wallet Address</label>
      <input
        className="input"
        value={customerWallet}
        onChange={(e) => {
          setCustomerWallet(e.target.value);
          if (walletError) setWalletError("");
        }}
        onBlur={() => {
          const trimmedWallet = customerWallet.trim();
          if (!trimmedWallet) {
            setWalletError("");
            return;
          }
          setWalletError(
            isValidAddress(trimmedWallet)
              ? ""
              : "Please enter a valid Stellar public key (G...).",
          );
        }}
        placeholder="G..."
        disabled={status === "loading"}
      />
      {walletError && <p className="error">{walletError}</p>}

      <label className="label">Amount (NOVA)</label>
      <input
        className="input"
        type="number"
        min="0.0000001"
        step="any"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="10"
        disabled={status === "loading"}
      />

      <button
        className="btn btn-primary"
        type="submit"
        disabled={status === "loading" || activeCampaigns.length === 0}
      >
        {status === "loading" ? "Issuing…" : "Issue Rewards"}
      </button>

      {message && (
        <p className={status === "error" ? "error" : "success"}>{message}</p>
      )}
      {txHash && (
        <p
          style={{
            fontSize: "0.8rem",
            color: "#94a3b8",
            marginTop: "0.5rem",
            fontFamily: "monospace",
          }}
        >
          Tx: {txHash}
        </p>
      )}
    </form>
  );
}
