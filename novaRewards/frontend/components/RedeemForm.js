'use client';
import { useState } from 'react';
import { StrKey, Asset, TransactionBuilder, Operation, Networks, BASE_FEE, Horizon } from 'stellar-sdk';
import { signAndSubmit } from '../lib/freighter';
import api from '../lib/api';
import { useWalletStore } from '../store/walletStore';

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const ISSUER_PUBLIC = process.env.NEXT_PUBLIC_ISSUER_PUBLIC;
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

/**
 * Form for redeeming NOVA tokens with a merchant.
 * Requirements: 4.1, 4.2, 4.5
 */
export default function RedeemForm({ onSuccess }) {
  const { publicKey: senderPublicKey, balance: senderBalance } = useWalletStore();
  const [merchantWallet, setMerchantWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  function isValidAddress(addr) {
    try { return StrKey.isValidEd25519PublicKey(addr); } catch { return false; }
  }

  async function handleRedeem(e) {
    e.preventDefault();
    setMessage('');

    if (!isValidAddress(merchantWallet)) {
      setMessage('Merchant wallet must be a valid Stellar public key.');
      setStatus('error');
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setMessage('Amount must be a positive number.');
      setStatus('error');
      return;
    }
    // Client-side balance check — Requirements 4.1
    if (Number(amount) > Number(senderBalance)) {
      setMessage(`Insufficient balance. Available: ${senderBalance} NOVA`);
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      // Build unsigned payment XDR (customer → merchant)
      const server = new Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(senderPublicKey);
      const novaAsset = new Asset('NOVA', ISSUER_PUBLIC);

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(Operation.payment({ destination: merchantWallet, asset: novaAsset, amount: String(amount) }))
        .setTimeout(180)
        .build();

      // Sign with Freighter and submit — Requirements 4.2
      const { txHash } = await signAndSubmit(tx.toXDR());

      // Record redemption in backend
      await api.post('/api/transactions/record', {
        txHash,
        txType: 'redemption',
        amount,
        fromWallet: senderPublicKey,
        toWallet: merchantWallet,
      });

      setStatus('done');
      setMessage(`Redemption successful! Tx: ${txHash.slice(0, 16)}…`);
      setMerchantWallet('');
      setAmount('');
      onSuccess?.();
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || err.message);
    }
  }

  return (
    <form onSubmit={handleRedeem}>
      <label className="label">Merchant Wallet Address</label>
      <input
        className="input"
        value={merchantWallet}
        onChange={(e) => setMerchantWallet(e.target.value)}
        placeholder="G..."
        disabled={status === 'loading'}
      />
      <label className="label">Amount to Redeem (NOVA)</label>
      <input
        className="input"
        type="number"
        min="0.0000001"
        step="any"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="50"
        disabled={status === 'loading'}
      />
      <button className="btn btn-primary" type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Redeeming…' : 'Redeem NOVA'}
      </button>
      {message && <p className={status === 'error' ? 'error' : 'success'}>{message}</p>}
    </form>
  );
}
