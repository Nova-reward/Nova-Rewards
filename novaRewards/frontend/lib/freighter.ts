/**
 * Freighter Wallet SDK Integration
 *
 * TypeScript wrappers around @stellar/freighter-api providing:
 * - Wallet detection & connection
 * - Transaction signing
 * - Network mismatch detection
 * - Install prompting
 */

import {
  isConnected,
  requestAccess,
  getPublicKey,
  signTransaction,
  getNetwork,
} from '@stellar/freighter-api';
import { Networks, TransactionBuilder } from 'stellar-sdk';

// ---------------------------------------------------------------------------
// Environment-derived constants
// ---------------------------------------------------------------------------

const NETWORK_PASSPHRASE: string =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

const HORIZON_URL: string =
  process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';

const EXPECTED_NETWORK_NAME: string =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'PUBLIC' : 'TESTNET';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FreighterNetworkInfo {
  network: string;
  networkPassphrase: string;
}

export interface SignResult {
  signedTxXdr: string;
}

export interface SubmitResult {
  txHash: string;
}

export class FreighterError extends Error {
  code: string;

  constructor(message: string, code: string = 'FREIGHTER_ERROR') {
    super(message);
    this.name = 'FreighterError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Installation detection
// ---------------------------------------------------------------------------

/**
 * Checks whether the Freighter browser extension is installed.
 *
 * @returns Promise resolving to true if Freighter is detected
 */
export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const result = await isConnected();
    return result.isConnected === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Connection & public key
// ---------------------------------------------------------------------------

/**
 * Requests access to Freighter and returns the user's public key.
 *
 * @returns Promise resolving to the Stellar public key (G...)
 * @throws FreighterError if access is denied or Freighter is not installed
 */
export async function connectWallet(): Promise<string> {
  try {
    const accessResult = await requestAccess();
    if (accessResult.error) {
      throw new FreighterError(
        `Freighter access denied: ${accessResult.error}`,
        'ACCESS_DENIED'
      );
    }

    const keyResult = await getPublicKey();
    if (keyResult.error) {
      throw new FreighterError(
        `Could not get public key: ${keyResult.error}`,
        'NO_PUBLIC_KEY'
      );
    }

    return keyResult.publicKey;
  } catch (err) {
    if (err instanceof FreighterError) throw err;
    throw new FreighterError(
      err instanceof Error ? err.message : 'Failed to connect wallet. Please try again.',
      'CONNECT_FAILED'
    );
  }
}

/**
 * Retrieves the public key from the currently connected Freighter wallet
 * without re-requesting access (assumes access was already granted).
 *
 * @returns Promise resolving to the Stellar public key
 * @throws FreighterError if public key cannot be retrieved
 */
export async function getFreighterPublicKey(): Promise<string> {
  try {
    const result = await getPublicKey();
    if (result.error) {
      throw new FreighterError(
        `Could not get public key: ${result.error}`,
        'NO_PUBLIC_KEY'
      );
    }
    return result.publicKey;
  } catch (err) {
    if (err instanceof FreighterError) throw err;
    throw new FreighterError(
      err instanceof Error ? err.message : 'Failed to retrieve public key.',
      'NO_PUBLIC_KEY'
    );
  }
}

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

/**
 * Returns the expected network passphrase for this dApp
 * (derived from NEXT_PUBLIC_STELLAR_NETWORK).
 */
export function getNetworkPassphrase(): string {
  return NETWORK_PASSPHRASE;
}

/**
 * Returns the expected network name for this dApp.
 */
export function getExpectedNetworkName(): string {
  return EXPECTED_NETWORK_NAME;
}

/**
 * Returns the Horizon server URL being used.
 */
export function getHorizonUrl(): string {
  return HORIZON_URL;
}

/**
 * Reads the currently selected network from Freighter.
 *
 * @returns Promise resolving to Freighter's active network info
 * @throws FreighterError if the network cannot be read
 */
export async function getFreighterNetwork(): Promise<FreighterNetworkInfo> {
  try {
    const result = await getNetwork();
    if (result.error) {
      throw new FreighterError(
        `Could not read Freighter network: ${result.error}`,
        'NETWORK_READ_FAILED'
      );
    }
    return {
      network: result.network || '',
      networkPassphrase: result.networkPassphrase || '',
    };
  } catch (err) {
    if (err instanceof FreighterError) throw err;
    throw new FreighterError(
      err instanceof Error ? err.message : 'Failed to read Freighter network.',
      'NETWORK_READ_FAILED'
    );
  }
}

/**
 * Checks whether Freighter is configured to the network expected by the dApp.
 *
 * @returns Promise resolving to true if there is a network mismatch
 */
export async function checkNetworkMismatch(): Promise<boolean> {
  try {
    const freighterNet = await getFreighterNetwork();
    // Compare by passphrase (most reliable) or by network name
    const passphraseMismatch =
      !!freighterNet.networkPassphrase &&
      freighterNet.networkPassphrase !== NETWORK_PASSPHRASE;

    const nameMismatch =
      !!freighterNet.network &&
      freighterNet.network !== EXPECTED_NETWORK_NAME;

    return passphraseMismatch || nameMismatch;
  } catch {
    // If we can't read the network, assume no mismatch to avoid blocking
    return false;
  }
}

/**
 * Ensures Freighter is on the correct network, throwing if not.
 *
 * @throws FreighterError with code NETWORK_MISMATCH if wrong network
 */
export async function requireCorrectNetwork(): Promise<void> {
  const hasMismatch = await checkNetworkMismatch();
  if (hasMismatch) {
    throw new FreighterError(
      `Network mismatch: Please switch Freighter to ${EXPECTED_NETWORK_NAME} before continuing.`,
      'NETWORK_MISMATCH'
    );
  }
}

// ---------------------------------------------------------------------------
// Transaction signing
// ---------------------------------------------------------------------------

/**
 * Signs an XDR transaction with Freighter without submitting.
 * Triggers the Freighter signing modal for user approval.
 *
 * @param xdr - Unsigned transaction XDR (base64)
 * @returns Promise resolving to the signed transaction XDR
 * @throws FreighterError if signing fails or user rejects
 */
export async function sign(xdr: string): Promise<string> {
  try {
    // Ensure Freighter is on the right network before signing
    await requireCorrectNetwork();

    const signResult = await signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    if (signResult.error) {
      throw new FreighterError(
        `Transaction signing failed: ${signResult.error}`,
        'SIGN_FAILED'
      );
    }

    return signResult.signedTxXdr;
  } catch (err) {
    if (err instanceof FreighterError) throw err;

    const message = err instanceof Error ? err.message : 'Failed to sign transaction.';
    if (message.toLowerCase().includes('user rejected') || message.toLowerCase().includes('denied')) {
      throw new FreighterError('You rejected the signing request. Please try again.', 'SIGN_REJECTED');
    }
    throw new FreighterError(message, 'SIGN_FAILED');
  }
}

/**
 * Signs an XDR transaction with Freighter and submits it to Horizon.
 *
 * @param xdr - Unsigned transaction XDR (base64)
 * @returns Promise resolving to the transaction hash
 * @throws FreighterError if signing or submission fails
 */
export async function signAndSubmit(xdr: string): Promise<SubmitResult> {
  // Ensure correct network before signing
  await requireCorrectNetwork();

  const signResult = await signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (signResult.error) {
    throw new FreighterError(
      `Transaction signing failed: ${signResult.error}`,
      'SIGN_FAILED'
    );
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
    throw new FreighterError(
      `Transaction submission failed: ${detail}`,
      'SUBMIT_FAILED'
    );
  }

  return { txHash: data.hash };
}

