import {
  isConnected,
  requestAccess,
  getPublicKey,
  signTransaction,
} from '@stellar/freighter-api';
import { Networks, TransactionBuilder } from 'stellar-sdk';

const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';

/**
 * Checks whether the Freighter browser extension is installed.
 * Requirements: 8.1
 *
 * @returns {Promise<boolean>}
 */
export async function isFreighterInstalled() {
  try {
    const result = await isConnected();
    return result.isConnected === true;
  } catch {
    return false;
  }
}

/**
 * Requests access to Freighter and returns the user's public key.
 * Requirements: 8.2
 *
 * @returns {Promise<string>} Stellar public key
 * @throws {Error} if user denies access or Freighter is not installed
 */
export async function connectWallet() {
  try {
    const accessResult = await requestAccess();
    if (accessResult.error) {
      throw new Error(`Freighter access denied: ${accessResult.error}`);
    }

    const keyResult = await getPublicKey();
    if (keyResult.error) {
      throw new Error(`Could not get public key: ${keyResult.error}`);
    }

    return keyResult.publicKey;
  } catch (err) {
    throw new Error(err.message || 'Failed to connect wallet. Please try again.');
  }
}

/**
 * Returns the current network passphrase based on NEXT_PUBLIC_STELLAR_NETWORK.
 * Requirements: 8.1
 *
 * @returns {string} Network passphrase (PUBLIC or TESTNET)
 */
export function getNetworkPassphrase() {
  return NETWORK_PASSPHRASE;
}

/**
 * Signs an XDR transaction with Freighter without submitting.
 * Returns the signed XDR for the caller to submit.
 * Requirements: 8.2
 *
 * @param {string} xdr - Unsigned transaction XDR string
 * @returns {Promise<string>} Signed transaction XDR
 * @throws {Error} if signing fails or user rejects
 */
export async function sign(xdr) {
  try {
    const signResult = await signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    if (signResult.error) {
      throw new Error(`Transaction signing failed: ${signResult.error}`);
    }

    return signResult.signedTxXdr;
  } catch (err) {
    if (err.message?.includes('User rejected')) {
      throw new Error('You rejected the signing request. Please try again.');
    }
    throw new Error(err.message || 'Failed to sign transaction. Please try again.');
  }
}

/**
 * Signs an XDR transaction with Freighter and submits it to Horizon.
 * Requirements: 8.2
 *
 * @param {string} xdr - Unsigned transaction XDR string
 * @returns {Promise<{ txHash: string }>}
 * @throws {Error} if signing fails or submission is rejected
 */
export async function signAndSubmit(xdr) {
  const signResult = await signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (signResult.error) {
    throw new Error(`Transaction signing failed: ${signResult.error}`);
  }

  const response = await fetch(`${HORIZON_URL}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ tx: signResult.signedTxXdr }),
  });

  const data = await response.json();

  if (!response.ok) {
    const detail =
      data?.extras?.result_codes?.transaction || data?.title || 'Unknown error';
    throw new Error(`Transaction submission failed: ${detail}`);
  }

  return { txHash: data.hash };
}
