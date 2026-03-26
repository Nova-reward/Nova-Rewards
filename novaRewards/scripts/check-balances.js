require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');

const ISSUER_PUBLIC = process.env.ISSUER_PUBLIC;
const DISTRIBUTION_PUBLIC = process.env.DISTRIBUTION_PUBLIC;
const NETWORK = (process.env.NETWORK || 'testnet').toLowerCase();

if (!ISSUER_PUBLIC || !DISTRIBUTION_PUBLIC) {
  console.error('Missing environment variables: ISSUER_PUBLIC and/or DISTRIBUTION_PUBLIC.');
  process.exit(1);
}

const horizonUrl =
  NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';

const server = new StellarSdk.Horizon.Server(horizonUrl);

async function checkAccountBalances(name, publicKey) {
  console.log(`\n--- Checking ${name} (${publicKey}) on ${NETWORK} ---`);

  if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
    console.error(`Invalid public key for ${name}: ${publicKey}`);
    return;
  }

  try {
    const account = await server.loadAccount(publicKey);

    const xlm = account.balances.find((b) => b.asset_type === 'native');
    const nova = account.balances.find(
      (b) => b.asset_type !== 'native' && b.asset_code === 'NOVA' && b.asset_issuer === ISSUER_PUBLIC
    );

    console.log(`XLM: ${xlm ? xlm.balance : '0'}`);
    console.log(`NOVA: ${nova ? nova.balance : '0'} (trustline ${nova ? 'exists' : 'missing'})`);

    if (!xlm || Number(xlm.balance) <= 1) {
      console.warn('Warning: XLM balance is low (<=1) for fees.');
    }
    if (!nova) {
      console.warn('Warning: NOVA trustline not found (balance 0).');
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`Account not found (unfunded or invalid): ${publicKey}`);
    } else {
      console.error(`Error loading account ${name} (${publicKey}):`, error.message || error);
    }
  }
}

async function checkBalances() {
  console.log('== Stellar account balance debug summary ==');
  await checkAccountBalances('ISSUER', ISSUER_PUBLIC);
  await checkAccountBalances('DISTRIBUTION', DISTRIBUTION_PUBLIC);
  console.log('\nDone.');
}

checkBalances();
