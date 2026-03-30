import { useWallet } from '../context/WalletContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Home() {
  const { publicKey, connect, loading, error, freighterInstalled, disconnect } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (publicKey) router.push('/dashboard');
  }, [publicKey, router]);

  const handleDisconnect = () => {
    disconnect();
    router.push('/');
  };

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">⭐ NovaRewards</span>
        <div className="nav-links">
          <a href="/merchant">Merchant Portal</a>
          <a href="/auth/register">Email Sign Up</a>
          <a href="/auth/login">Email Login</a>
          {publicKey && (
            <button
              className="btn btn-secondary"
              onClick={handleDisconnect}
              style={{ padding: "0.4rem 1rem" }}
            >
              Disconnect
            </button>
          )}
        </div>
      </nav>

      <div className="container" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>
          Own Your Rewards
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '2.5rem', maxWidth: 500, margin: '0 auto 2.5rem' }}>
          NovaRewards puts loyalty tokens on the Stellar blockchain — earn, transfer,
          and redeem NOVA tokens across any participating merchant.
        </p>

        {freighterInstalled === false ? (
          <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
            <p style={{ marginBottom: '1rem' }}>
              Freighter Wallet is required to use NovaRewards.
            </p>
            <a
              href="https://www.freighter.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Install Freighter Wallet
            </a>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            style={{ fontSize: '1.1rem', padding: '0.8rem 2rem' }}
            onClick={connect}
            disabled={loading}
          >
            {loading ? 'Connecting…' : 'Connect Freighter Wallet'}
          </button>
        )}

        {error && <p className="error" style={{ marginTop: '1rem' }}>{error}</p>}

        {/* TODO: link tokenomics doc — add a "Tokenomics" section here pointing to docs/tokenomics.md or the hosted URL */}
      </div>
    </>
  );
}
