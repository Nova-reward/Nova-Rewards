# Issue: Closes #12
# Title: fix: handle 404 errors for unfunded Stellar accounts

### Description:
If a wallet address has never been funded on the network, server.loadAccount throws a 404 error. This PR adds robust error handling to gracefully catch these cases.

### Key Changes:
- **Horizon Fallback:** Added a check for both err.response.status === 404 and a message-based fallback (err.message.includes('not found')) to handle differing Horizon SDK version signatures.
- **Improved Stability:** getNOVABalance and verifyTrustline now return safer defaults ('0' or { exists: false }) for unfunded accounts instead of crashing.
