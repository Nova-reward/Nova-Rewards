import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { useRouter } from 'next/router';

// ── Animation helpers ──────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
};
const stagger = { visible: { transition: { staggerChildren: 0.12 } } };

function FadeIn({ children, className, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

function StaggerList({ children, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={stagger}
    >
      {children}
    </motion.div>
  );
}

// ── Data ───────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '⭐',
    title: 'Earn on Every Purchase',
    desc: 'Customers collect Nova tokens automatically with every qualifying transaction — no punch cards, no friction.',
  },
  {
    icon: '🔄',
    title: 'Transfer & Trade Freely',
    desc: 'Rewards live on the Stellar blockchain. Send them to friends, trade on DEXs, or hold for future value.',
  },
  {
    icon: '🎁',
    title: 'Redeem Anywhere',
    desc: 'A growing catalogue of rewards across partner merchants. One token, endless possibilities.',
  },
  {
    icon: '🔒',
    title: 'Self-Custody Security',
    desc: 'Your rewards, your keys. No platform lock-in — connect any Stellar-compatible wallet.',
  },
  {
    icon: '📊',
    title: 'Real-Time Analytics',
    desc: 'Merchants get live dashboards showing campaign performance, redemption rates, and customer insights.',
  },
  {
    icon: '🌐',
    title: 'Multi-Currency Support',
    desc: 'Issue rewards in Nova tokens or any Stellar asset. Settle in the currency that works for your business.',
  },
];

const STEPS = [
  { step: '01', title: 'Connect Your Wallet', desc: 'Link your Freighter or Albedo wallet in seconds. No account creation required.' },
  { step: '02', title: 'Shop at Partners', desc: 'Earn Nova tokens automatically when you transact at any participating merchant.' },
  { step: '03', title: 'Redeem or Trade', desc: 'Spend your tokens in the rewards catalogue or trade them on the Stellar DEX.' },
];

const MERCHANT_BENEFITS = [
  { icon: '🚀', title: 'Launch in Minutes', desc: 'Create a rewards campaign with our no-code dashboard. Go live the same day.' },
  { icon: '💰', title: 'Reduce Churn', desc: 'Token-based loyalty increases repeat purchase rates by up to 40% vs. traditional programs.' },
  { icon: '📈', title: 'Grow Your Audience', desc: 'Tap into the Nova network of active Stellar users already looking for your products.' },
  { icon: '🔧', title: 'Full API Access', desc: 'Integrate directly into your POS or e-commerce stack with our REST API and webhooks.' },
];

const TESTIMONIALS = [
  {
    quote: 'Nova Rewards transformed our loyalty program. Our repeat customer rate jumped 35% in the first quarter.',
    name: 'Sarah K.',
    role: 'Owner, Stellar Coffee Co.',
    avatar: 'SK',
  },
  {
    quote: "Finally a rewards platform that doesn't lock customers in. My users love that they actually own their points.",
    name: 'Marcus T.',
    role: 'CTO, ShopLocal',
    avatar: 'MT',
  },
  {
    quote: 'The analytics dashboard alone is worth it. I can see exactly which campaigns drive real revenue.',
    name: 'Priya M.',
    role: 'Marketing Lead, NovaMart',
    avatar: 'PM',
  },
];

// ── Structured data ────────────────────────────────────────────────────────
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Nova Rewards',
  applicationCategory: 'FinanceApplication',
  description: 'Tokenized loyalty and rewards platform built on the Stellar blockchain.',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

// ── Page ───────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { publicKey } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (publicKey) router.push('/dashboard');
  }, [publicKey, router]);

  return (
    <>
      <Head>
        <title>Nova Rewards — Tokenized Loyalty on Stellar</title>
        <meta name="description" content="Earn, transfer, and redeem blockchain-powered rewards with Nova Rewards. Built on Stellar for merchants and customers who want loyalty that actually works." />
        <meta name="keywords" content="loyalty rewards, Stellar blockchain, crypto rewards, merchant loyalty, Nova Rewards" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://novarewards.app" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://novarewards.app" />
        <meta property="og:title" content="Nova Rewards — Tokenized Loyalty on Stellar" />
        <meta property="og:description" content="Earn, transfer, and redeem blockchain-powered rewards. Built on Stellar." />
        <meta property="og:image" content="https://novarewards.app/og-image.png" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@novarewards" />
        <meta name="twitter:title" content="Nova Rewards — Tokenized Loyalty on Stellar" />
        <meta name="twitter:description" content="Earn, transfer, and redeem blockchain-powered rewards. Built on Stellar." />
        <meta name="twitter:image" content="https://novarewards.app/og-image.png" />
        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </Head>

      <div className="landing-page">
        <LandingNav />
        <main id="main-content">
          <HeroSection />
          <FeaturesSection />
          <HowItWorksSection />
          <MerchantsSection />
          <TestimonialsSection />
          <CTASection />
        </main>
      </div>
    </>
  );
}

// ── Nav ────────────────────────────────────────────────────────────────────
function LandingNav() {
  return (
    <header className="landing-nav" role="banner">
      <div className="landing-nav-inner">
        <Link href="/" className="landing-logo" aria-label="Nova Rewards home">
          ⭐ <span>NovaRewards</span>
        </Link>
        <nav aria-label="Main navigation">
          <ul className="landing-nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#merchants">For Merchants</a></li>
          </ul>
        </nav>
        <div className="landing-nav-cta">
          <Link href="/merchant" className="btn-outline-sm">Merchant Portal</Link>
          <Link href="/auth/register" className="btn-primary-sm">Get Started</Link>
        </div>
      </div>
    </header>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="hero-section" aria-labelledby="hero-heading">
      <div className="hero-bg-glow" aria-hidden="true" />
      <div className="landing-container hero-inner">
        <motion.div
          className="hero-content"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="hero-badge">
            🚀 Now live on Stellar Mainnet
          </motion.div>
          <motion.h1 id="hero-heading" variants={fadeUp} className="hero-title">
            Loyalty Rewards<br />
            <span className="hero-title-accent">You Actually Own</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="hero-subtitle">
            Nova Rewards puts loyalty tokens on the Stellar blockchain — earn on every purchase,
            transfer freely, and redeem across a growing network of merchants.
          </motion.p>
          <motion.div variants={fadeUp} className="hero-actions">
            <Link href="/auth/register" className="btn-hero-primary">
              Start Earning Free
            </Link>
            <Link href="/merchant" className="btn-hero-secondary">
              I&apos;m a Merchant →
            </Link>
          </motion.div>
          <motion.p variants={fadeUp} className="hero-footnote">
            No credit card required · Self-custody · Built on Stellar
          </motion.p>
        </motion.div>
        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          aria-hidden="true"
        >
          <div className="hero-card-mock">
            <div className="mock-card-header">
              <span className="mock-avatar">JD</span>
              <div>
                <div className="mock-name">Jane Doe</div>
                <div className="mock-wallet">G3XK…9F2A</div>
              </div>
            </div>
            <div className="mock-balance-label">Nova Balance</div>
            <div className="mock-balance">2,450 <span>NOVA</span></div>
            <div className="mock-progress-bar">
              <div className="mock-progress-fill" style={{ width: '68%' }} />
            </div>
            <div className="mock-progress-label">68% to next reward tier</div>
            <div className="mock-actions">
              <span className="mock-action-btn">Redeem</span>
              <span className="mock-action-btn">Transfer</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────
function FeaturesSection() {
  return (
    <section id="features" className="landing-section" aria-labelledby="features-heading">
      <div className="landing-container">
        <FadeIn className="section-header">
          <h2 id="features-heading" className="section-title">Everything loyalty should be</h2>
          <p className="section-subtitle">
            Built from the ground up for the blockchain era — fast, transparent, and user-owned.
          </p>
        </FadeIn>
        <StaggerList className="features-grid">
          {FEATURES.map((f) => (
            <motion.div key={f.title} variants={fadeUp} className="feature-card">
              <div className="feature-icon" aria-hidden="true">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </motion.div>
          ))}
        </StaggerList>
      </div>
    </section>
  );
}

// ── How It Works ───────────────────────────────────────────────────────────
function HowItWorksSection() {
  return (
    <section id="how-it-works" className="landing-section landing-section-alt" aria-labelledby="hiw-heading">
      <div className="landing-container">
        <FadeIn className="section-header">
          <h2 id="hiw-heading" className="section-title">Up and running in three steps</h2>
          <p className="section-subtitle">No complicated setup. Just connect, earn, and redeem.</p>
        </FadeIn>
        <StaggerList className="steps-list">
          {STEPS.map((s) => (
            <motion.div key={s.step} variants={fadeUp} className="step-item">
              <div className="step-number" aria-hidden="true">{s.step}</div>
              <div className="step-connector" aria-hidden="true" />
              <div className="step-body">
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </StaggerList>
      </div>
    </section>
  );
}

// ── Merchants ──────────────────────────────────────────────────────────────
function MerchantsSection() {
  return (
    <section id="merchants" className="landing-section" aria-labelledby="merchants-heading">
      <div className="landing-container merchants-layout">
        <FadeIn className="merchants-copy">
          <div className="section-eyebrow">For Merchants</div>
          <h2 id="merchants-heading" className="section-title left">
            Turn every transaction into a relationship
          </h2>
          <p className="section-subtitle left">
            Launch a fully branded rewards program in minutes. No blockchain expertise required —
            we handle the smart contracts, you focus on your customers.
          </p>
          <Link href="/merchant" className="btn-hero-primary" style={{ display: 'inline-flex', marginTop: '1.5rem' }}>
            Start Free Trial →
          </Link>
        </FadeIn>
        <StaggerList className="merchant-benefits-grid">
          {MERCHANT_BENEFITS.map((b) => (
            <motion.div key={b.title} variants={fadeUp} className="merchant-benefit-card">
              <div className="merchant-benefit-icon" aria-hidden="true">{b.icon}</div>
              <div>
                <h3 className="merchant-benefit-title">{b.title}</h3>
                <p className="merchant-benefit-desc">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </StaggerList>
      </div>
    </section>
  );
}

// ── Testimonials ───────────────────────────────────────────────────────────
function TestimonialsSection() {
  return (
    <section className="landing-section landing-section-alt" aria-labelledby="testimonials-heading">
      <div className="landing-container">
        <FadeIn className="section-header">
          <h2 id="testimonials-heading" className="section-title">Trusted by merchants and customers</h2>
        </FadeIn>
        <StaggerList className="testimonials-grid">
          {TESTIMONIALS.map((t) => (
            <motion.figure key={t.name} variants={fadeUp} className="testimonial-card">
              <blockquote className="testimonial-quote">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="testimonial-author">
                <div className="testimonial-avatar" aria-hidden="true">{t.avatar}</div>
                <div>
                  <div className="testimonial-name">{t.name}</div>
                  <div className="testimonial-role">{t.role}</div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </StaggerList>
      </div>
    </section>
  );
}

// ── CTA ────────────────────────────────────────────────────────────────────
function CTASection() {
  return (
    <section className="cta-section" aria-labelledby="cta-heading">
      <div className="cta-glow" aria-hidden="true" />
      <div className="landing-container cta-inner">
        <FadeIn>
          <h2 id="cta-heading" className="cta-title">Ready to own your rewards?</h2>
          <p className="cta-subtitle">
            Join thousands of users already earning on the Stellar network.
          </p>
          <div className="cta-actions">
            <Link href="/auth/register" className="btn-hero-primary">
              Create Free Account
            </Link>
            <Link href="/merchant" className="btn-hero-secondary">
              Merchant Sign Up
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
