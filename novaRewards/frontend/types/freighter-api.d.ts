/**
 * Type declarations for @stellar/freighter-api
 *
 * Provides explicit TypeScript interfaces for the Freighter browser
 * extension SDK so consumers get full intellisense and type safety.
 */

declare module '@stellar/freighter-api' {
  /**
   * Result returned by isConnected().
   */
  export interface IsConnectedResult {
    isConnected: boolean;
    error?: string;
  }

  /**
   * Result returned by requestAccess().
   */
  export interface RequestAccessResult {
    address?: string;
    error?: string;
  }

  /**
   * Result returned by getPublicKey().
   */
  export interface GetPublicKeyResult {
    publicKey: string;
    error?: string;
  }

  /**
   * Options passed to signTransaction().
   */
  export interface SignTransactionOptions {
    network?: string;
    networkPassphrase?: string;
  }

  /**
   * Result returned by signTransaction().
   */
  export interface SignTransactionResult {
    signedTxXdr: string;
    error?: string;
  }

  /**
   * Result returned by getNetwork().
   */
  export interface GetNetworkResult {
    network: string;
    networkPassphrase: string;
    error?: string;
  }

  /**
   * Checks whether the Freighter extension is installed and reachable.
   */
  export function isConnected(): Promise<IsConnectedResult>;

  /**
   * Requests the user to grant access to their Freighter wallet.
   */
  export function requestAccess(): Promise<RequestAccessResult>;

  /**
   * Retrieves the public key of the currently connected Freighter account.
   */
  export function getPublicKey(): Promise<GetPublicKeyResult>;

  /**
   * Requests the user to sign a Stellar transaction.
   */
  export function signTransaction(
    xdr: string,
    opts?: SignTransactionOptions
  ): Promise<SignTransactionResult>;

  /**
   * Retrieves the network that Freighter is currently configured to use.
   */
  export function getNetwork(): Promise<GetNetworkResult>;
}

