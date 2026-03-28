/**
 * hello-stellar.ts
 * Quick-Start: fetch a Stellar testnet account balance.
 *
 * Usage:
 *   npx ts-node scripts/hello-stellar.ts
 *   # or add to package.json scripts: "hello-stellar": "ts-node scripts/hello-stellar.ts"
 *
 * Set STELLAR_PUBLIC_KEY in your environment or .env file.
 * If unset, a random keypair is generated and funded via Friendbot.
 */

import { Horizon, Keypair } from "@stellar/stellar-sdk";
import https from "https";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";

async function fundWithFriendbot(publicKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(`${FRIENDBOT_URL}?addr=${publicKey}`, (res) => {
        res.resume(); // drain response
        res.on("end", resolve);
      })
      .on("error", reject);
  });
}

async function main() {
  const server = new Horizon.Server(HORIZON_URL);

  let publicKey = process.env.STELLAR_PUBLIC_KEY;

  if (!publicKey) {
    const keypair = Keypair.random();
    publicKey = keypair.publicKey();
    console.log(`No STELLAR_PUBLIC_KEY set — generated: ${publicKey}`);
    console.log("Funding via Friendbot (testnet only)…");
    await fundWithFriendbot(publicKey);
  }

  const account = await server.loadAccount(publicKey);

  console.log(`\nAccount: ${publicKey}`);
  console.log("Balances:");
  for (const { asset_type, asset_code, balance } of account.balances) {
    const label = asset_type === "native" ? "XLM" : asset_code;
    console.log(`  ${label}: ${balance}`);
  }
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
