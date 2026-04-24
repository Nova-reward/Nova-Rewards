import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function Offline() {
  const [isOnline, setIsOnline] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setTimeout(() => router.push('/dashboard'), 1000);
    };

    window.addEventListener('online', handleOnline);
    setIsOnline(navigator.onLine);

    return () => window.removeEventListener('online', handleOnline);
  }, [router]);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <svg style={styles.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
        </svg>
        <h1 style={styles.title}>You're Offline</h1>
        <p style={styles.message}>
          {isOnline 
            ? 'Connection restored! Redirecting...' 
            : 'Check your internet connection and try again.'}
        </p>
        {!isOnline && (
          <button 
            style={styles.button}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  content: {
    textAlign: 'center',
    padding: '2rem',
  },
  icon: {
    width: '4rem',
    height: '4rem',
    margin: '0 auto 1rem',
    color: '#6b7280',
  },
  title: {
    fontSize: '1.875rem',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '0.5rem',
  },
  message: {
    fontSize: '1.125rem',
    color: '#6b7280',
    marginBottom: '1.5rem',
  },
  button: {
    backgroundColor: '#4F46E5',
    color: 'white',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    fontSize: '1rem',
    cursor: 'pointer',
  },
};
