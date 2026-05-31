# Wallet Connection — Nova Rewards

This document explains how to connect a wallet to the Nova Rewards web app and common troubleshooting steps.

## Supported wallets

- Wallets that support the platform's network (browser extensions and WalletConnect-compatible mobile wallets).
- Examples: MetaMask, WalletConnect-compatible mobile wallets, and platform-specific wallets. Your deployment may list exact supported providers.

## Connect from the web UI

1. Open the Nova Rewards web app and click the `Connect Wallet` button in the top-right corner.
2. A chooser will appear listing available providers. Select your wallet.
3. If using a browser-extension wallet (e.g., MetaMask), the extension will open a confirmation popup — approve the connection.
4. If using WalletConnect, scan the displayed QR code with your mobile wallet app and approve the connection on your device.
5. Once connected, the UI will display your abbreviated address and network.

## Approving transactions

- When you perform actions that require on-chain transactions (redeem, claim, transfer), your wallet will prompt you to approve the transaction and show the fee estimate.
- Review the amount, destination, and fee before approving.

## Network selection

- Ensure your wallet is set to the correct network (mainnet, testnet, or a custom RPC) that the Nova Rewards deployment uses.
- If prompted to switch networks, follow the UI instructions or use your wallet to switch.

## Disconnecting and switching accounts

- To switch accounts, disconnect from the UI and reconnect using the desired account in your wallet provider.
- Use the `Disconnect` or `Sign Out` action in the app when you finish a session on a shared device.

## Security and privacy

- Never share your private keys or seed phrase. Nova Rewards will never ask for them.
- Verify the app URL and certificate before connecting.
- Approve only transactions you initiated and understand.

## Troubleshooting

- No wallet options shown: confirm your browser has an installed extension or try WalletConnect.
- Connection fails repeatedly: reload the page, clear site data, or try a different browser.
- Transactions stuck/pending: check on-chain status with the transaction hash; if stuck, you may need to speed up or cancel using your wallet.

If problems persist, contact support with screenshots and the transaction hash where applicable.
