import { useState, useEffect } from 'react';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div style={{
      ...styles.banner,
      backgroundColor: isOnline ? '#10b981' : '#ef4444',
    }}>
      <p style={styles.text}>
        {isOnline ? '✓ Back online' : '⚠ You are offline'}
      </p>
    </div>
  );
}

const styles = {
  banner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    padding: '0.75rem',
    textAlign: 'center',
    zIndex: 9999,
    transition: 'all 0.3s ease',
  },
  text: {
    margin: 0,
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
};
