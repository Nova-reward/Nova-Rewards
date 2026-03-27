'use client';
import { useState } from 'react';
import { Asset, TransactionBuilder, Operation, Networks, BASE_FEE, Horizon } from 'stellar-sdk';
import { signAndSubmit } from '../lib/freighter';
import api from '../lib/api';
import TransactionLink from './TransactionLink';
import ConfirmationModal from './ConfirmationModal';

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const ISSUER_PUBLIC = process.env.NEXT_PUBLIC_ISSUER_PUBLIC;
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

/**
 * Form for sending NOVA tokens to another wallet (peer-to-peer).
 * Requirements: 5.1, 5.2, 5.3, 5.6
 */
export default function TransferForm({ senderPublicKey, senderBalance, onSuccess }) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  async function handleTransfer(e) {
    e.preventDefault();
    setMessage('');

    // Client-side validation — Requirements 5.1
    if (!isValidStellarAddress(recipient)) {
      setMessage('Recipient must be a valid Stellar public key.');
      setStatus('error');
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setMessage('Amount must be a positive number.');
      setStatus('error');
      return;
    }
    if (Number(amount) > Number(senderBalance)) {
      setMessage(`Insufficient balance. Available: ${senderBalance} NOVA`);
      setStatus('error');
      return;
    }

    // Show confirmation modal
    setShowConfirmation(true);
  }

  async function executeTransfer() {
    setShowConfirmation(false);
    setStatus('loading');
    try {
      // Verify recipient trustline — Requirements 5.2
      const { data: trustlineData } = await api.post('/api/trustline/verify', {
        walletAddress: recipient,
      });
      if (!trustlineData.data.exists) {
        setMessage('Recipient does not have a NOVA trustline. They must create one first.');
        setStatus('error');
        return;
      }

      // Build unsigned payment XDR
      const server = new Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(senderPublicKey);
      const novaAsset = new Asset('NOVA', ISSUER_PUBLIC);

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(Operation.payment({ destination: recipient, asset: novaAsset, amount: String(amount) }))
        .setTimeout(180)
        .build();

      // Sign with Freighter and submit — Requirements 5.3
      const result = await signAndSubmit(tx.toXDR());
      setTxHash(result.txHash);

      // Record in backend
      await api.post('/api/transactions/record', {
        txHash: result.txHash,
        txType: 'transfer',
        amount,
        fromWallet: senderPublicKey,
        toWallet: recipient,
      });

      setStatus('done');
      setMessage('Transfer successful!');
      setRecipient('');
      setAmount('');
      onSuccess?.();
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || err.message);
    }
  }

  return (
    <>
      <form onSubmit={handleTransfer}>
        <label className="label">Recipient Wallet Address</label>
        <input
          className="input"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="G..."
          disabled={status === 'loading'}
        />
        <label className="label">Amount (NOVA)</label>
        <input
          className="input"
          type="number"
          min="0.0000001"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10"
          disabled={status === 'loading'}
        />
        <button className="btn btn-primary" type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Sending…' : 'Send NOVA'}
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

      <ConfirmationModal
        isOpen={showConfirmation}
        onConfirm={executeTransfer}
        onCancel={() => setShowConfirmation(false)}
        recipient={recipient}
        amount={amount}
        asset="NOVA"
        operation="transfer"
      />
    </>
  );
}
