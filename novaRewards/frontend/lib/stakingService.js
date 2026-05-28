import * as StellarSdk from 'stellar-sdk';
import { signTransaction } from './freighter';

const STAKING_CONTRACT_ID = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ID;
const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' 
  ? StellarSdk.Networks.PUBLIC 
  : StellarSdk.Networks.TESTNET;

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

/**
 * Stake tokens
 * @param {string} stakerPublicKey - The staker's public key
 * @param {number} amount - Amount to stake
 * @returns {Promise<object>} Transaction result
 */
export async function stakeTokens(stakerPublicKey, amount) {
  try {
    const account = await server.loadAccount(stakerPublicKey);
    
    // Convert amount to contract format (7 decimal places for Stellar)
    const contractAmount = Math.floor(amount * 10000000);

    // Build the contract invocation
    const contract = new StellarSdk.Contract(STAKING_CONTRACT_ID);
    
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'stake',
          StellarSdk.Address.fromString(stakerPublicKey).toScVal(),
          StellarSdk.nativeToScVal(contractAmount, { type: 'i128' })
        )
      )
      .setTimeout(180)
      .build();

    // Sign and submit
    const signedXdr = await signTransaction(transaction.toXDR(), NETWORK_PASSPHRASE);
    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const result = await server.submitTransaction(signedTx);

    return {
      success: true,
      hash: result.hash,
      amount: amount,
    };
  } catch (error) {
    console.error('Stake error:', error);
    throw new Error(error.message || 'Failed to stake tokens');
  }
}

/**
 * Unstake tokens
 * @param {string} stakerPublicKey - The staker's public key
 * @returns {Promise<object>} Transaction result with returned amount
 */
export async function unstakeTokens(stakerPublicKey) {
  try {
    const account = await server.loadAccount(stakerPublicKey);
    
    const contract = new StellarSdk.Contract(STAKING_CONTRACT_ID);
    
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'unstake',
          StellarSdk.Address.fromString(stakerPublicKey).toScVal()
        )
      )
      .setTimeout(180)
      .build();

    const signedXdr = await signTransaction(transaction.toXDR(), NETWORK_PASSPHRASE);
    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const result = await server.submitTransaction(signedTx);

    // Parse the result to get the returned amount
    // This would need to be extracted from the transaction result
    const returnedAmount = 0; // TODO: Parse from result

    return {
      success: true,
      hash: result.hash,
      returnedAmount,
    };
  } catch (error) {
    console.error('Unstake error:', error);
    throw new Error(error.message || 'Failed to unstake tokens');
  }
}

/**
 * Get stake position for a user
 * @param {string} stakerPublicKey - The staker's public key
 * @returns {Promise<object|null>} Stake position or null
 */
export async function getStakePosition(stakerPublicKey) {
  try {
    const contract = new StellarSdk.Contract(STAKING_CONTRACT_ID);
    const account = await server.loadAccount(stakerPublicKey);
    
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'get_stake',
          StellarSdk.Address.fromString(stakerPublicKey).toScVal()
        )
      )
      .setTimeout(180)
      .build();

    const result = await server.simulateTransaction(transaction);
    
    if (!result.results || result.results.length === 0) {
      return null;
    }

    // Parse the stake record from the result
    const stakeRecord = result.results[0].xdr;
    // TODO: Parse the XDR to extract stake details
    
    return {
      stakedAmount: 0,
      accruedRewards: 0,
      stakedAt: new Date(),
      status: 'active',
      cooldownEnd: null,
    };
  } catch (error) {
    console.error('Get stake position error:', error);
    return null;
  }
}

/**
 * Get staking pool statistics
 * @returns {Promise<object>} Pool statistics
 */
export async function getStakingStats() {
  try {
    // In a real implementation, these would come from the contract or backend API
    // For now, returning mock data structure
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/staking/stats`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch staking stats');
    }
    
    const data = await response.json();
    
    return {
      apy: data.apy || 10.5,
      tvl: data.tvl || 1000000,
      totalStakers: data.totalStakers || 150,
      totalRewardsDistributed: data.totalRewardsDistributed || 50000,
    };
  } catch (error) {
    console.error('Get staking stats error:', error);
    // Return default values if API fails
    return {
      apy: 10.5,
      tvl: 1000000,
      totalStakers: 150,
      totalRewardsDistributed: 50000,
    };
  }
}

/**
 * Calculate estimated rewards
 * @param {number} amount - Stake amount
 * @param {number} days - Number of days
 * @param {number} apy - Annual percentage yield
 * @returns {number} Estimated rewards
 */
export function calculateEstimatedRewards(amount, days, apy) {
  const dailyRate = apy / 365 / 100;
  return amount * dailyRate * days;
}

/**
 * Get annual rate from contract
 * @returns {Promise<number>} Annual rate in basis points
 */
export async function getAnnualRate() {
  try {
    const contract = new StellarSdk.Contract(STAKING_CONTRACT_ID);
    const sourceAccount = await server.loadAccount(
      // Use a dummy account for simulation
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
    );
    
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_annual_rate'))
      .setTimeout(180)
      .build();

    const result = await server.simulateTransaction(transaction);
    
    if (!result.results || result.results.length === 0) {
      return 1000; // Default 10%
    }

    // Parse the result
    // TODO: Extract the actual rate from XDR
    return 1000; // 10% in basis points
  } catch (error) {
    console.error('Get annual rate error:', error);
    return 1000; // Default 10%
  }
}

/**
 * Claim accrued rewards without unstaking
 * @param {string} stakerPublicKey - The staker's public key
 * @returns {Promise<object>} Transaction result
 */
export async function claimRewards(stakerPublicKey) {
  try {
    const account = await server.loadAccount(stakerPublicKey);
    
    const contract = new StellarSdk.Contract(STAKING_CONTRACT_ID);
    
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'claim_rewards',
          StellarSdk.Address.fromString(stakerPublicKey).toScVal()
        )
      )
      .setTimeout(180)
      .build();

    const signedXdr = await signTransaction(transaction.toXDR(), NETWORK_PASSPHRASE);
    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const result = await server.submitTransaction(signedTx);

    return {
      success: true,
      hash: result.hash,
    };
  } catch (error) {
    console.error('Claim rewards error:', error);
    throw new Error(error.message || 'Failed to claim rewards');
  }
}
