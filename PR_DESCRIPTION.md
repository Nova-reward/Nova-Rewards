# Issue: Closes #168
# Title: feat: implement referral link generation and sharing UI

### Description:
Introduces the UI for generating, copying, and sharing referral links with on-chain rewards tracking.

### Key Changes:
- **ReferralLink Component:** Built a premium React component with linear-gradient aesthetics and responsive grid layout.
- **Copy to Clipboard:** Integrated the Clipboard API with a document.execCommand fallback for maximum browser compatibility; includes a 2-second visual confirmation.
- **Sharing Integration:** Added direct sharing shortcuts for WhatsApp, Twitter/X, and Email, plus a native navigator.share fallback for mobile devices.
- **User Dashboard:** Integrated the component into the main dashboard to display real-time referral stats.
