'use client';
import { useState, useEffect } from 'react';
import { Asset, TransactionBuilder, Operation, Networks, BASE_FEE, Horizon } from 'stellar-sdk';
import { signAndSubmit } from '../lib/freighter';
import api from '../lib/api';
import TransactionLink from './TransactionLink';

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const ISSUER_PUBLIC = process.env.NEXT_PUBLIC_ISSUER_PUBLIC;
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

const STEPS = { SELECT: 0, AMOUNT: 1, CONFIRM: 2, SIGNING: 3, SUCCESS: 4 };

/**
 * Multi-step redemption flow.
 * Closes #595
 */
export default function RedemptionFlow({ walletAddress, onSuccess }) {
  const [step, setStep] = useState(STEPS.SELECT);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load campaigns and balance on mount
  useEffect(() => {
    async function load() {
      try {
        const [campRes, balRes] = await Promise.all([
          api.get('/api/redemptions/campaigns'),
          api.get(`/api/wallet/balance?address=${walletAddress}`),
        ]);
        setCampaigns(campRes.data?.data || []);
        setBalance(balRes.data?.data?.nova ?? balRes.data?.balance ?? 0);
      } catch {
        setError('Failed to load campaigns or balance.');
      }
    }
    if (walletAddress) load();
  }, [walletAddress]);

  function validateAmount(val) {
    const n = Number(val);
    if (!val || isNaN(n) || n <= 0) { setAmountError('Enter a positive amount.'); return false; }
    if (n > Number(balance)) { setAmountError(`Insufficient balance. Available: ${balance} NOVA`); return false; }
    setAmountError('');
    return true;
  }

  async function handleConfirm() {
    setError('');
    setStep(STEPS.SIGNING);
    setLoading(true);
    try {
      const server = new Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(walletAddress);
      const novaAsset = new Asset('NOVA', ISSUER_PUBLIC);

      const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(Operation.payment({
          destination: selectedCampaign.merchant_wallet,
          asset: novaAsset,
          amount: String(amount),
        }))
        .setTimeout(180)
        .build();

      const result = await signAndSubmit(tx.toXDR());
      setTxHash(result.txHash);

      await api.post('/api/redemptions', {
        campaignId: selectedCampaign.id,
        amount: Number(amount),
        txHash: result.txHash,
        walletAddress,
      });

      setStep(STEPS.SUCCESS);
      onSuccess?.({ txHash: result.txHash, amount, campaign: selectedCampaign });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Redemption failed.');
      setStep(STEPS.CONFIRM);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep(STEPS.SELECT);
    setSelectedCampaign(null);
    setAmount('');
    setAmountError('');
    setTxHash('');
    setError('');
  }

  // ── Step 0: Campaign selector ──────────────────────────────────────────
  if (step === STEPS.SELECT) {
    return (
      <div className="redemption-flow">
        <h2 className="redemption-title">Select Campaign</h2>
        {error && <p className="error">{error}</p>}
        {campaigns.length === 0 && !error && <p className="muted">No redemption campaigns available.</p>}
        <ul className="campaign-list">
          {campaigns.map((c) => (
            <li key={c.id}>
              <button
                className="campaign-option"
                onClick={() => { setSelectedCampaign(c); setStep(STEPS.AMOUNT); }}
              >
                <span className="campaign-name">{c.name}</span>
                <span className="campaign-rate">Rate: {c.reward_rate} NOVA / perk</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ── Step 1: Amount input ───────────────────────────────────────────────
  if (step === STEPS.AMOUNT) {
    return (
      <div className="redemption-flow">
        <h2 className="redemption-title">Enter Amount</h2>
        <p className="muted">Campaign: <strong>{selectedCampaign.name}</strong></p>
        <p className="muted">Balance: <strong>{balance} NOVA</strong></p>
        <label className="label" htmlFor="redeem-amount">Amount to Redeem (NOVA)</label>
        <input
          id="redeem-amount"
          className={`input ${amountError ? 'input-error' : ''}`}
          type="number"
          min="0.0000001"
          step="any"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); validateAmount(e.target.value); }}
          placeholder="e.g. 50"
        />
        {amountError && <p className="error" style={{ marginTop: '0.25rem' }}>{amountError}</p>}
        <div className="flow-actions">
          <button className="btn btn-secondary" onClick={() => setStep(STEPS.SELECT)}>Back</button>
          <button
            className="btn btn-primary"
            onClick={() => { if (validateAmount(amount)) setStep(STEPS.CONFIRM); }}
          >
            Review
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Confirmation ───────────────────────────────────────────────
  if (step === STEPS.CONFIRM) {
    const perkValue = (Number(amount) * Number(selectedCampaign.reward_rate)).toFixed(4);
    return (
      <div className="redemption-flow">
        <h2 className="redemption-title">Confirm Redemption</h2>
        {error && <p className="error">{error}</p>}
        <dl className="confirm-details">
          <dt>Campaign</dt><dd>{selectedCampaign.name}</dd>
          <dt>Tokens to burn</dt><dd>{amount} NOVA</dd>
          <dt>Perk value received</dt><dd>{perkValue}</dd>
          <dt>Exchange rate</dt><dd>{selectedCampaign.reward_rate} per NOVA</dd>
        </dl>
        <div className="flow-actions">
          <button className="btn btn-secondary" onClick={() => setStep(STEPS.AMOUNT)}>Back</button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            Sign &amp; Redeem
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Signing ────────────────────────────────────────────────────
  if (step === STEPS.SIGNING) {
    return (
      <div className="redemption-flow redemption-signing">
        <div className="spinner" aria-label="Waiting for Freighter signature" />
        <p>Waiting for Freighter signature…</p>
      </div>
    );
  }

  // ── Step 4: Success ────────────────────────────────────────────────────
  return (
    <div className="redemption-flow redemption-success">
      <div className="success-icon" aria-hidden="true">✅</div>
      <h2 className="redemption-title">Redemption Successful!</h2>
      <p>You redeemed <strong>{amount} NOVA</strong> via <strong>{selectedCampaign.name}</strong>.</p>
      <p>
        Transaction:{' '}
        <TransactionLink
          txHash={txHash}
          network={process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'}
        />
      </p>
      <button className="btn btn-secondary" onClick={reset}>Redeem Again</button>
    </div>
  );
}
