# Freighter Wallet Integration Guide

This guide covers everything a frontend developer needs to work with the Freighter wallet integration in Nova Rewards — from installation through testing and debugging.

---

## What is Freighter?

[Freighter](https://www.freighter.app) is a browser extension wallet for the Stellar network. It holds the user's Stellar keypair and exposes a JavaScript API (`@stellar/freighter-api`) that dApps use to:

- Detect whether the extension is installed
- Request access to the user's public key
- Ask the user to sign transactions (the private key never leaves the extension)
- Read the currently selected network

Nova Rewards uses Freighter as its primary wallet. The user's public key identifies their on-chain account; every reward issuance, redemption, and transfer is a Stellar transaction signed by Freighter.

---

## Installing Freighter for Development

1. Install the extension from [freighter.app](https://www.freighter.app) (Chrome, Firefox, or Brave).
2. Create a new wallet or import an existing one.
3. Switch to **Testnet**: open the extension → Settings → Network → Testnet.
4. Fund your testnet account using [Stellar Friendbot](https://friendbot.stellar.org/?addr=YOUR_PUBLIC_KEY) — this gives you 10,000 XLM to cover fees and base reserves.

> The local Docker stack runs a Stellar standalone node. See [Testing Locally](#testing-wallet-interactions-locally) for how to add it as a custom network in Freighter.

---

## Project Structure

The Freighter integration lives in three files:

| File | Purpose |
|------|---------|
| `novaRewards/frontend/lib/freighter.ts` | Core wrappers around `@stellar/freighter-api` |
| `novaRewards/frontend/store/walletStore.js` | Zustand store — wallet state, connect/disconnect/sign actions |
| `novaRewards/frontend/context/WalletContext.js` | React context — exposes wallet state to components via `useWallet()` |

Components never call `@stellar/freighter-api` directly. They go through `lib/freighter.ts`, which normalises errors into typed `FreighterError` instances.

---

## API Methods Used in This Project

### `isFreighterInstalled()`

Checks whether the extension is present. Returns `true`/`false` — never throws.

```ts
import { isFreighterInstalled } from '../lib/freighter';

const installed = await isFreighterInstalled();
if (!installed) {
  // Show FreighterInstallModal
}
```

Internally calls `isConnected()` from `@stellar/freighter-api` and treats any exception as "not installed".

---

### `connectWallet()`

Requests access to the user's wallet and returns their public key (`G…`).

```ts
import { connectWallet } from '../lib/freighter';

const publicKey = await connectWallet();
// publicKey → "GABC...XYZ"
```

This triggers the Freighter permission popup. If the user denies it, a `FreighterError` with code `ACCESS_DENIED` is thrown. If the extension is not installed, a `FreighterError` with code `CONNECT_FAILED` is thrown.

---

### `getFreighterNetwork()`

Reads the network Freighter is currently configured to use.

```ts
import { getFreighterNetwork } from '../lib/freighter';

const { network, networkPassphrase } = await getFreighterNetwork();
// network → "TESTNET" | "PUBLIC" | custom name
// networkPassphrase → "Test SDF Network ; September 2015"
```

---

### `checkNetworkMismatch()`

Returns `true` if Freighter's active network does not match `NEXT_PUBLIC_STELLAR_NETWORK`. The app calls this immediately after connecting and on rehydration.

```ts
import { checkNetworkMismatch } from '../lib/freighter';

const mismatch = await checkNetworkMismatch();
if (mismatch) {
  // Show network mismatch warning — do not block the connection
}
```

The comparison uses both the network name and the passphrase. If the network cannot be read, the function returns `false` (fail open) to avoid blocking users.

---

### `sign(xdr)`

Signs an unsigned transaction XDR with Freighter. Verifies the network first, then triggers the Freighter signing modal.

```ts
import { sign } from '../lib/freighter';

const signedXdr = await sign(unsignedXdr);
// Pass signedXdr to the backend: POST /api/transactions { signedXdr }
```

Throws `FreighterError` with code `SIGN_REJECTED` if the user dismisses the modal, or `NETWORK_MISMATCH` if the network check fails before the modal even opens.

---

### `signAndSubmit(xdr)`

Signs and submits directly to Horizon. Returns `{ txHash }`. Use this for simple flows where the backend does not need to inspect the transaction first.

```ts
import { signAndSubmit } from '../lib/freighter';

const { txHash } = await signAndSubmit(unsignedXdr);
```

---

### `FreighterError`

All errors from `lib/freighter.ts` are instances of `FreighterError`, which extends `Error` with a `code` field:

```ts
import { FreighterError } from '../lib/freighter';

try {
  await sign(xdr);
} catch (err) {
  if (err instanceof FreighterError) {
    switch (err.code) {
      case 'NETWORK_MISMATCH': // user is on wrong network
      case 'SIGN_REJECTED':    // user dismissed the modal
      case 'SIGN_FAILED':      // signing failed for another reason
      case 'ACCESS_DENIED':    // user denied wallet access
      case 'NO_PUBLIC_KEY':    // could not retrieve public key
      case 'CONNECT_FAILED':   // general connection failure
    }
  }
}
```

The `walletStore` maps these codes to user-friendly strings before storing them in `state.error`.

---

## How the Wallet State Flows

```
User clicks "Connect Wallet"
  → WalletConnectFlow checks isFreighterInstalled()
      → not installed: show FreighterInstallModal
      → installed: call walletStore.connect()
          → connectWallet() → Freighter permission popup
          → getFreighterNetwork() + checkNetworkMismatch()
          → set publicKey, walletType, networkMismatch in store
          → refreshBalance() → Horizon API
          → persist publicKey + walletType to localStorage

Page reload
  → zustand/persist rehydrates publicKey + walletType from localStorage
  → onRehydrateStorage calls walletStore.rehydrate()
      → getNOVABalance() + getTransactionHistory() from Horizon
      → checkNetworkMismatch() for Freighter wallets
      → stale key (Horizon 404) → clear localStorage + reset state
```

Components read state via `useWallet()` (from `WalletContext`) or `useWalletStore()` (Zustand directly). Both expose the same shape.

---

## Testing Wallet Interactions Locally

### 1. Add the local Stellar node to Freighter

The Docker stack runs a Stellar standalone node at `http://localhost:8000`.

In Freighter: Settings → Network → Add a custom network:

| Field | Value |
|-------|-------|
| Network name | `Local` |
| Horizon URL | `http://localhost:8000` |
| Passphrase | `Standalone Network ; February 2017` |

Switch to this network when testing against the local stack.

Set `NEXT_PUBLIC_STELLAR_NETWORK=standalone` and `NEXT_PUBLIC_HORIZON_URL=http://localhost:8000` in `novaRewards/.env` to match.

### 2. Unit tests — mock `lib/freighter.ts`

The test suite in `lib/__tests__/freighter.test.ts` mocks `@stellar/freighter-api` at the module level:

```ts
jest.mock('@stellar/freighter-api', () => ({
  isConnected: () => mockIsConnected(),
  requestAccess: () => mockRequestAccess(),
  getPublicKey: () => mockGetPublicKey(),
  signTransaction: (xdr, opts) => mockSignTransaction(xdr, opts),
  getNetwork: () => mockGetNetwork(),
}));
```

Component tests (e.g. `__tests__/WalletConnectButton.test.js`) mock `lib/freighter` directly:

```ts
jest.mock('../lib/freighter', () => ({
  isFreighterInstalled: jest.fn(),
  connectWallet: jest.fn(),
  sign: jest.fn(),
  getNetworkPassphrase: jest.fn(() => 'Test SDF Network ; September 2015'),
}));
```

Then control behaviour per test:

```ts
isFreighterInstalled.mockResolvedValue(true);
connectWallet.mockResolvedValue('GABC...XYZ');
```

Run unit tests:

```bash
cd novaRewards
npm run test:frontend
```

### 3. E2E tests — inject a mock extension

Playwright tests use `mockFreighterExtension()` from `e2e/helpers.js`. This injects a `window.freighter` object before the page loads, simulating the extension without needing it installed in the test browser.

```js
const { mockFreighterExtension, mockHorizonAPI } = require('./helpers');

test('connects wallet', async ({ page }) => {
  await mockFreighterExtension(page, { installed: true, authorized: true });
  await mockHorizonAPI(page, { balance: '500.0000000' });
  // ... rest of test
});
```

---

## Simulating Different Wallet States

All options are passed to `mockFreighterExtension()` in E2E tests, or set directly on the Zustand store in unit tests.

### Connected wallet

```js
// E2E
await mockFreighterExtension(page, { installed: true, authorized: true, publicKey: 'GABC...' });
await page.evaluate((key) => {
  localStorage.setItem('walletPublicKey', key);
  localStorage.setItem('walletType', 'freighter');
}, 'GABC...');
await page.reload();

// Unit
useWalletStore.setState({ publicKey: 'GABC...', walletType: 'freighter', balance: '100' });
```

### Disconnected / not installed

```js
// E2E
await mockFreighterExtension(page, { installed: false });

// Unit
isFreighterInstalled.mockResolvedValue(false);
```

### Wrong network (network mismatch)

```js
// E2E — Freighter reports PUBLIC when app expects TESTNET
await mockFreighterExtension(page, { installed: true, authorized: true, networkMismatch: true });

// Unit — getNetwork returns PUBLIC passphrase
mockGetNetwork.mockResolvedValue({
  network: 'PUBLIC',
  networkPassphrase: 'Public Global Stellar Network ; September 2015',
});
```

The store sets `networkMismatch: true` and the UI renders a warning banner. The user is not blocked from using the app, but signing will fail with `NETWORK_MISMATCH` until they switch networks.

### User denies access

```js
// E2E
await mockFreighterExtension(page, { installed: true, accessDenialError: 'denied' });

// Unit
connectWallet.mockRejectedValue(new FreighterError('Access denied', 'ACCESS_DENIED'));
```

### User rejects signing

```js
// Unit
sign.mockRejectedValue(new FreighterError('You rejected the signing request.', 'SIGN_REJECTED'));
```

---

## Common Errors and Fixes

| Error / Symptom | Cause | Fix |
|-----------------|-------|-----|
| "Freighter wallet extension is not installed" | Extension not in browser | Install from [freighter.app](https://www.freighter.app) |
| "You denied wallet access" | User clicked Reject in the Freighter popup | Click Connect again and approve |
| "Network mismatch: Please switch Freighter to Testnet" | Freighter is set to Mainnet (or vice versa) | Open Freighter → Settings → Network → switch to Testnet |
| "Network mismatch" on local stack | Freighter not configured for the standalone node | Add the local network to Freighter (see [Testing Locally](#testing-wallet-interactions-locally)) |
| "Could not retrieve your public key" | Access was granted but key read failed | Unlock Freighter and try again |
| "You rejected the signing request" | User dismissed the signing modal | Retry the action and approve in Freighter |
| `tx_bad_seq` from Horizon | Transaction sequence number is stale | The backend rebuilds the transaction; retry the action |
| `op_bad_auth` from Horizon | Transaction signed with wrong key or wrong network passphrase | Verify `NEXT_PUBLIC_STELLAR_NETWORK` matches Freighter's network |
| Balance shows 0 after connecting | Horizon request failed or account not funded | Check `NEXT_PUBLIC_HORIZON_URL`; fund the account via Friendbot |
| Wallet state lost on page reload | `localStorage` cleared or `zustand/persist` key changed | Check browser storage; the key is `nova-wallet-storage` |

---

## Further Reading

- [Freighter API reference](https://docs.freighter.app)
- [`lib/freighter.ts`](../../novaRewards/frontend/lib/freighter.ts) — annotated source
- [`store/walletStore.js`](../../novaRewards/frontend/store/walletStore.js) — Zustand store
- [`e2e/helpers.js`](../../novaRewards/frontend/e2e/helpers.js) — `mockFreighterExtension` and related utilities
- [Stellar & Soroban Integration Guide](./integration.md) — broader Stellar context
- [Troubleshooting Guide](../troubleshooting.md)
