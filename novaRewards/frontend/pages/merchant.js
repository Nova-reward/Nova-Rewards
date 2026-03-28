import { useState, useEffect, useCallback } from "react";
import CampaignForm from "../components/CampaignForm";
import IssueRewardForm from "../components/IssueRewardForm";
import api from "../lib/api";

/**
 * Merchant dashboard — registration, campaigns, reward issuance, totals.
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */
export default function MerchantDashboard() {
  // Registration state
  const [regForm, setRegForm] = useState({
    name: "",
    walletAddress: "",
    businessCategory: "",
  });
  const [merchant, setMerchant] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [regStatus, setRegStatus] = useState("idle");
  const [regMessage, setRegMessage] = useState("");

  // Dashboard state
  const [campaigns, setCampaigns] = useState([]);
  const [totals, setTotals] = useState({
    totalDistributed: 0,
    totalRedeemed: 0,
  });
  const [totalsLoading, setTotalsLoading] = useState(false);

  const getMerchantTotals = useCallback(async (mid) => {
    setTotalsLoading(true);
    try {
      const totalsRes = await api.get(
        `/api/transactions/merchant-totals/${mid}`,
      );
      setTotals(
        totalsRes.data.data || { totalDistributed: 0, totalRedeemed: 0 },
      );
    } catch {
      setTotals({ totalDistributed: 0, totalRedeemed: 0 });
    } finally {
      setTotalsLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(
    async (mid) => {
      try {
        const [campRes] = await Promise.all([api.get(`/api/campaigns/${mid}`)]);
        setCampaigns(campRes.data.data || []);
        await getMerchantTotals(mid);
      } catch {
        // silently ignore on first load
      }
    },
    [getMerchantTotals],
  );

  useEffect(() => {
    if (merchant?.id) loadDashboard(merchant.id);
  }, [merchant, loadDashboard]);

  async function handleRegister(e) {
    e.preventDefault();
    setRegMessage("");
    setRegStatus("loading");
    try {
      const { data } = await api.post("/api/merchants/register", regForm);
      setMerchant(data.data);
      setApiKey(data.data.api_key);
      setRegStatus("done");
    } catch (err) {
      setRegStatus("error");
      setRegMessage(err.response?.data?.message || err.message);
    }
  }

  const setReg = (field) => (e) =>
    setRegForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">⭐ NovaRewards</span>
        <div className="nav-links">
          <a href="/">Customer Portal</a>
        </div>
      </nav>

      <div className="container">
        <h1
          style={{
            marginBottom: "1.5rem",
            fontSize: "1.8rem",
            fontWeight: 700,
          }}
        >
          Merchant Portal
        </h1>

        {/* Registration */}
        {!merchant ? (
          <div className="card">
            <h2 style={{ marginBottom: "1rem" }}>Register as a Merchant</h2>
            <form onSubmit={handleRegister}>
              <label className="label">Business Name</label>
              <input
                className="input"
                value={regForm.name}
                onChange={setReg("name")}
                placeholder="Acme Coffee"
                disabled={regStatus === "loading"}
              />

              <label className="label">Stellar Wallet Address</label>
              <input
                className="input"
                value={regForm.walletAddress}
                onChange={setReg("walletAddress")}
                placeholder="G..."
                disabled={regStatus === "loading"}
              />

              <label className="label">Business Category (optional)</label>
              <input
                className="input"
                value={regForm.businessCategory}
                onChange={setReg("businessCategory")}
                placeholder="Food & Beverage"
                disabled={regStatus === "loading"}
              />

              <button
                className="btn btn-primary"
                type="submit"
                disabled={regStatus === "loading"}
              >
                {regStatus === "loading" ? "Registering…" : "Register"}
              </button>
              {regMessage && <p className="error">{regMessage}</p>}
            </form>
          </div>
        ) : (
          <>
            {/* Merchant info + API key */}
            <div className="card">
              <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                Logged in as
              </p>
              <p style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                {merchant.name}
              </p>
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.8rem",
                  color: "#94a3b8",
                  marginTop: "0.3rem",
                }}
              >
                API Key: <span style={{ color: "#7c3aed" }}>{apiKey}</span>
              </p>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#64748b",
                  marginTop: "0.3rem",
                }}
              >
                Keep this key secret — it authorises reward distributions.
              </p>
            </div>

            {/* Totals summary — Requirements 10.2 */}
            <div className="card">
              {totalsLoading && (
                <p
                  style={{
                    color: "#94a3b8",
                    fontSize: "0.8rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  Refreshing totals…
                </p>
              )}
              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                <div>
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                    Total Distributed
                  </p>
                  <p
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: 700,
                      color: "#7c3aed",
                    }}
                  >
                    {parseFloat(totals.totalDistributed).toFixed(2)}
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: "0.8rem" }}>NOVA</p>
                </div>
                <div>
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                    Total Redeemed
                  </p>
                  <p
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: 700,
                      color: "#34d399",
                    }}
                  >
                    {parseFloat(totals.totalRedeemed).toFixed(2)}
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: "0.8rem" }}>NOVA</p>
                </div>
              </div>
            </div>

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
                merchantId={merchant.id}
                apiKey={apiKey}
                onSuccess={() => loadDashboard(merchant.id)}
              />
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
                    <tr>
                      <th>Name</th>
                      <th>Rate</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => {
                      const expired = new Date(c.end_date) < new Date();
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
