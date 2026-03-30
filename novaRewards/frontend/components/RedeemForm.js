'use client';
import { useState } from 'react';
import { StrKey, Asset, TransactionBuilder, Operation, Networks, BASE_FEE, Horizon } from 'stellar-sdk';
import { signAndSubmit } from '../lib/freighter';
import api from '../lib/api';
import TransactionLink from './TransactionLink';
import ConfirmationModal from './ConfirmationModal';

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
  const [amountError, setAmountError] = useState('');


  function isValidAddress(addr) {
    try { return StrKey.isValidEd25519PublicKey(addr); } catch { return false; }
  }

  function validateAmount(value) {
    if (!value || value.trim() === '') {
      setAmountError('');
      return false;
    }
    const numValue = Number(value);
    if (isNaN(numValue) || numValue <= 0) {
      setAmountError('Amount must be a positive number.');
      return false;
    }
    if (numValue > Number(senderBalance)) {
      setAmountError(`Insufficient balance. Available: ${senderBalance} NOVA`);
      return false;
    }
    setAmountError('');
    return true;
  }

  function handleAmountChange(e) {
    const value = e.target.value;
    setAmount(value);
    validateAmount(value);
  }

  async function handleRedeem(e) {
    e.preventDefault();
    setMessage('');

    if (!isValidAddress(merchantWallet)) {
      setMessage('Merchant wallet must be a valid Stellar public key.');
      setStatus('error');
      return;
    }
    
    // Validate amount before submission
    if (!validateAmount(amount)) {
      setStatus('error');
      return;
    }

    // Show confirmation modal
    setShowConfirmation(true);
  }

  async function executeRedeem() {
    setShowConfirmation(false);
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
      const result = await signAndSubmit(tx.toXDR());
      setTxHash(result.txHash);

      // Record redemption in backend
      await api.post('/api/transactions/record', {
        txHash: result.txHash,
        txType: 'redemption',
        amount,
        fromWallet: senderPublicKey,
        toWallet: merchantWallet,
      });

      setStatus('done');
      setMessage('Redemption successful!');
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
        onChange={handleAmountChange}
        placeholder="50"
        disabled={status === 'loading'}
      />
      {amountError && <p className="error" style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>{amountError}</p>}
      <button className="btn btn-primary" type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Redeeming…' : 'Redeem NOVA'}
      </button>
      {message && (
        <p className={status === 'error' ? 'error' : 'success'}>
          {message}
          {txHash && (
            <span> Transaction: <TransactionLink txHash={txHash} /></span>
          )}
        </p>
      )}
    </form>
  );
}
