import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import CampaignForm from "../components/CampaignForm";
import IssueRewardForm from "../components/IssueRewardForm";
import Navbar from "../components/Navbar";
import api from "../lib/api";

function getCampaignStatus(c) {
  const now = new Date();
  const start = new Date(c.start_date);
  const end = new Date(c.end_date);
  if (now < start) return "upcoming";
  if (now > end || !c.is_active) return "ended";
  return "active";
}

const STATUS_LABELS = { active: "Active", ended: "Ended", upcoming: "Upcoming" };
const STATUS_BADGES = { active: "badge-green", ended: "badge-gray", upcoming: "badge-blue" };
const FILTER_OPTIONS = ["all", "active", "ended", "upcoming"];

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

  // Search / filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const router = useRouter();
  const urlSyncReady = useRef(false);

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

  // Initialise filters from URL once router is ready
  useEffect(() => {
    if (!router.isReady) return;
    urlSyncReady.current = true;
    setSearchQuery(router.query.q || "");
    setDebouncedSearch(router.query.q || "");
    setStatusFilter(router.query.status || "all");
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search input by 300 ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Reflect active filters in URL query string
  useEffect(() => {
    if (!router.isReady || !urlSyncReady.current) return;
    const query = {};
    if (debouncedSearch) query.q = debouncedSearch;
    if (statusFilter !== "all") query.status = statusFilter;
    router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  }, [debouncedSearch, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <Navbar />

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
              <div style={{ display: "flex", gap: "2rem" }}>
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
                <>
                  {/* Search and status filter controls */}
                  <div style={{ marginBottom: "1.25rem" }}>
                    <label
                      htmlFor="campaign-search"
                      className="label"
                      style={{ marginBottom: "0.4rem" }}
                    >
                      Search
                    </label>
                    <input
                      id="campaign-search"
                      type="search"
                      className="input"
                      style={{ marginBottom: "0.75rem" }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name…"
                      aria-label="Search campaigns by name"
                    />
                    <div
                      role="group"
                      aria-label="Filter by status"
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      {FILTER_OPTIONS.map((s) => (
                        <button
                          key={s}
                          className={`btn ${statusFilter === s ? "btn-primary" : "btn-secondary"}`}
                          style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                          onClick={() => setStatusFilter(s)}
                          aria-pressed={statusFilter === s}
                        >
                          {s === "all" ? "All" : STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const filtered = campaigns.filter((c) => {
                      if (
                        debouncedSearch &&
                        !c.name
                          .toLowerCase()
                          .includes(debouncedSearch.toLowerCase())
                      )
                        return false;
                      if (
                        statusFilter !== "all" &&
                        getCampaignStatus(c) !== statusFilter
                      )
                        return false;
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <p style={{ color: "#94a3b8" }}>
                          No campaigns match your filters.
                        </p>
                      );
                    }

                    return (
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
                          {filtered.map((c) => {
                            const status = getCampaignStatus(c);
                            return (
                              <tr key={c.id}>
                                <td>{c.name}</td>
                                <td>{c.reward_rate} NOVA/unit</td>
                                <td>{c.start_date?.slice(0, 10)}</td>
                                <td>{c.end_date?.slice(0, 10)}</td>
                                <td>
                                  <span
                                    className={`badge ${STATUS_BADGES[status]}`}
                                  >
                                    {STATUS_LABELS[status]}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
