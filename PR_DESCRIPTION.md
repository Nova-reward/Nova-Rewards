# Issue: Closes #14
# Title: feat: implement getAsset helper for consistent asset instantiation

### Description:
Refactored asset construction to use a centralized helper instead of inline new Asset() calls.

### Key Changes:
- **Centralized Helper:** Added getAsset(code, issuer) to stellarService.js.
- **Native Support:** Automatically returns Asset.native() if the code is 'XLM' or 'native', ensuring native payments are handled correctly.
- **Uniformity:** Updated NOVA and related constants to use the helper throughout the blockchain module.
