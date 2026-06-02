import { useState } from 'react';

/**
 * Fires when a user votes on an FAQ item.
 * Replace the console.log with an API call when the endpoint is ready.
 * @param {string} id - FAQ item identifier (e.g. "faq-1")
 * @param {boolean} helpful - true = Yes, false = No
 */
function handleFAQFeedback(id, helpful) {
  console.log('[FAQ feedback]', { id, helpful });
}

function FAQItem({ id, question, answer }) {
  const [open, setOpen] = useState(false);
  const [voted, setVoted] = useState(null); // null | 'yes' | 'no'

  function vote(value) {
    if (voted) return;
    setVoted(value);
    handleFAQFeedback(id, value === 'yes');
  }

  return (
    <div className="faq-item">
      <button
        className="faq-question"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <span className="faq-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="faq-answer">
          <p>{answer}</p>

          <div className="faq-feedback">
            <span className="faq-feedback-label">Was this helpful?</span>
            <button
              className={`faq-feedback-btn${voted === 'yes' ? ' faq-feedback-btn--active' : ''}`}
              onClick={() => vote('yes')}
              disabled={!!voted}
              aria-label="Yes, this was helpful"
            >
              👍 Yes
            </button>
            <button
              className={`faq-feedback-btn${voted === 'no' ? ' faq-feedback-btn--active' : ''}`}
              onClick={() => vote('no')}
              disabled={!!voted}
              aria-label="No, this was not helpful"
            >
              👎 No
            </button>
            {voted && (
              <span className="faq-feedback-thanks">Thanks for your feedback!</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FAQSection({ title, items }) {
  return (
    <section className="faq-section">
      <h2 className="faq-section-title">{title}</h2>
      {items.map((item) => (
        <FAQItem key={item.id} {...item} />
      ))}
    </section>
  );
}

const FAQ_DATA = [
  {
    section: '🚀 Getting Started',
    items: [
      {
        id: 'faq-1',
        question: 'What is Nova Rewards?',
        answer:
          'Nova Rewards is a loyalty platform that lets you earn digital reward points every time you shop with participating merchants. Your points are stored securely and can be redeemed for discounts, vouchers, and other perks — all in one place.',
      },
      {
        id: 'faq-2',
        question: 'How do I create an account?',
        answer:
          'Click Sign Up on the homepage and fill in your name, email address, and a password (at least 8 characters). Once you submit, your account is created instantly and you can start earning points right away.',
      },
      {
        id: 'faq-3',
        question: 'Do I need to verify my identity (KYC)?',
        answer:
          'For basic earning and redemption, no identity verification is required. If you want to withdraw rewards above a certain threshold or access advanced features, we may ask you to complete a quick identity check. You\'ll be guided through it step by step inside the app.',
      },
      {
        id: 'faq-4',
        question: 'Is Nova Rewards free to use?',
        answer:
          'Yes. Creating an account and earning points costs nothing. Some premium redemption options may have a minimum point requirement, but there are no subscription fees.',
      },
      {
        id: 'faq-5',
        question: 'I forgot my password. How do I reset it?',
        answer:
          'On the login page, click Forgot Password and enter your email address. You\'ll receive a reset link within a few minutes. Check your spam folder if it doesn\'t arrive.',
      },
    ],
  },
  {
    section: '🎁 Points & Rewards',
    items: [
      {
        id: 'faq-6',
        question: 'How do I earn points?',
        answer:
          'Points are awarded automatically when a participating merchant sends you a reward after a qualifying action — such as making a purchase, completing a referral, or taking part in a campaign.',
      },
      {
        id: 'faq-7',
        question: 'How do I redeem my points?',
        answer:
          'Go to the Rewards page, browse the available items, and click Redeem next to the one you want. Your points will be deducted and the reward will be confirmed on screen. You\'ll also receive a confirmation email.',
      },
      {
        id: 'faq-8',
        question: 'Can my points expire?',
        answer:
          'Points do not expire under normal circumstances. If a merchant\'s campaign ends, any points tied specifically to that campaign may no longer be redeemable for campaign-specific perks. Your general point balance is always yours to keep.',
      },
      {
        id: 'faq-9',
        question: 'What are Drops, and how do I claim one?',
        answer:
          'Drops are limited-time bonus rewards released to eligible users. When a Drop is available for your account, a notification will appear on your dashboard. Click Claim to add the bonus points to your balance. Each Drop can only be claimed once.',
      },
      {
        id: 'faq-10',
        question: 'What is the referral bonus?',
        answer:
          'When you invite a friend using your personal referral link and they sign up and complete their first qualifying action, both you and your friend receive a bonus. Find your referral link on the Referral page in the sidebar.',
      },
    ],
  },
  {
    section: '💳 Wallet & Tokens',
    items: [
      {
        id: 'faq-11',
        question: 'What is a Stellar wallet, and do I need one?',
        answer:
          'Nova Rewards uses the Stellar network to record and transfer your reward tokens securely. Think of a Stellar wallet as a secure digital pocket that holds your tokens. We recommend the free Freighter browser extension as the easiest option.',
      },
      {
        id: 'faq-12',
        question: 'How do I connect my Stellar wallet?',
        answer:
          'Install the Freighter browser extension, create or import a wallet inside it, then click Connect Wallet on your Nova Rewards dashboard. Freighter will ask you to approve the connection — click Approve. Your wallet address will then appear on your dashboard.',
      },
      {
        id: 'faq-13',
        question: 'What is a "trustline" and why do I need to set one up?',
        answer:
          'Before your wallet can receive NOVA tokens, it needs to be told to accept them — this is called a trustline. It\'s a one-time setup. On your dashboard, click Add NOVA Trustline and approve the security confirmation in Freighter. You only need to do this once.',
      },
      {
        id: 'faq-14',
        question: 'What is staking, and how does it work?',
        answer:
          'Staking means locking a portion of your NOVA tokens to earn extra bonus tokens over time. Choose an amount to stake on your dashboard, confirm, and your tokens are locked. While staked, your balance grows based on the current annual reward rate. When you unstake, you receive your original tokens back plus any bonus earned.',
      },
      {
        id: 'faq-15',
        question: 'Can I unstake my tokens early?',
        answer:
          'Yes. You can unstake at any time. Your bonus is calculated up to the moment you unstake, so you\'ll still receive any bonus earned so far — you just won\'t earn further bonus after unstaking.',
      },
      {
        id: 'faq-16',
        question: 'Is my wallet safe?',
        answer:
          'Nova Rewards never stores your private wallet key — only you hold that through Freighter. All token transfers require your explicit approval via a security confirmation pop-up. Admin functions use multi-approval controls, and all smart contracts have been independently audited.',
      },
    ],
  },
  {
    section: '⚙️ Account Settings',
    items: [
      {
        id: 'faq-17',
        question: 'How do I update my profile information?',
        answer:
          'Go to Settings from the sidebar. You can update your display name, bio, and linked wallet address there. Changes are saved immediately.',
      },
      {
        id: 'faq-18',
        question: 'How do I change my password?',
        answer:
          'Password changes are handled on the Settings page under the Security section. You\'ll need to confirm your current password before making changes.',
      },
      {
        id: 'faq-19',
        question: 'How do I delete my account?',
        answer:
          'You can request account deletion from Settings → Account → Delete Account. Your personal information will be anonymised within 30 days. Your on-chain token balance is unaffected — tokens in your Stellar wallet remain yours.',
      },
      {
        id: 'faq-20',
        question: 'How do I contact support?',
        answer:
          'Use the Help button in the bottom-right corner of any page, or email us at support@novarewards.io. We aim to respond within one business day.',
      },
    ],
  },
];

export default function HelpCenterFAQ() {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? FAQ_DATA.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(search.toLowerCase()) ||
            item.answer.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((section) => section.items.length > 0)
    : FAQ_DATA;

  return (
    <div className="faq-container">
      <div className="faq-header">
        <h1 className="faq-title">Help Center</h1>
        <p className="faq-subtitle">
          Find answers to common questions about Nova Rewards.
        </p>
        <input
          className="faq-search"
          type="search"
          placeholder="Search questions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search FAQ"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="faq-no-results">
          No results for &ldquo;{search}&rdquo;. Try different keywords or{' '}
          <a href="mailto:support@novarewards.io">contact support</a>.
        </p>
      ) : (
        filtered.map((section) => (
          <FAQSection key={section.section} title={section.section} items={section.items} />
        ))
      )}
    </div>
  );
}
