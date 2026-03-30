import { useState, useEffect, useCallback, useRef } from 'react';
import Lottie from 'lottie-react';
import api from '../lib/api';
import { useWallet } from '../context/WalletContext';
import counterAnimationData from '../public/points-counter-increment.json';
import styles from '../styles/PointsWidget.module.css';

/**
 * Real-time widget that tracks and displays the user's point balance.
 * Features: Initial fetch, smooth transitions, skeleton loader, 
 * delta indicator (+/-), and error handling with retry.
 */
export default function PointsWidget() {
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState(null);
  const [prevBalance, setPrevBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [delta, setDelta] = useState(null);
  const [showDelta, setShowDelta] = useState(false);
  const [showCounterAnimation, setShowCounterAnimation] = useState(false);

  const fetchPoints = useCallback(async (isInitial = false) => {
    if (!publicKey) return;
    if (isInitial) setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/api/users/${publicKey}/points`);
      const newBalance = response.data.data.balance;

      setBalance((current) => {
        if (current !== null && current !== newBalance) {
          const diff = newBalance - current;
          setDelta(diff);
          setShowDelta(true);
          setShowCounterAnimation(true);
          setTimeout(() => setShowDelta(false), 3000);
          setTimeout(() => setShowCounterAnimation(false), 700);
          setPrevBalance(current);
        }
        return newBalance;
      });
    } catch (err) {
      console.error('Failed to fetch points:', err);
      if (isInitial) setError('Failed to load points');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [publicKey]);

  // Initial fetch and polling
  useEffect(() => {
    fetchPoints(true);
    const interval = setInterval(() => fetchPoints(), 5000);
    return () => clearInterval(interval);
  }, [fetchPoints]);

  if (loading) {
    return (
      <div className={styles.widgetContainer}>
        <div className={styles.label}>Nova Points</div>
        <div className={styles.skeleton}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.widgetContainer}>
        <div className={styles.errorText}>{error}</div>
        <button className={styles.retryBtn} onClick={() => fetchPoints(true)}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.widgetContainer} data-tour="points-widget">
      <div className={styles.label}>Nova Points</div>
      <div className={styles.balanceWrapper}>
        <div className={styles.balanceWithAnimation}>
          <AnimatedCounter value={balance} />
          {showCounterAnimation && (
            <div className={styles.lottieOverlay}>
              <Lottie animationData={counterAnimationData} loop={false} />
            </div>
          )}
        </div>
        {showDelta && delta !== 0 && (
          <div className={`${styles.delta} ${delta > 0 ? styles.positive : styles.negative}`}>
            {delta > 0 ? `+${delta}` : delta}
          </div>
        )}
      </div>
    </div>
  );
}

function AnimatedCounter({ value }) {
  const [displayValue, setDisplayValue] = useState(value);
  const requestRef = useRef();
  const startTimeRef = useRef();
  const duration = 1000;

  useEffect(() => {
    const startValue = displayValue;
    const endValue = value;
    
    if (startValue === endValue) return;

    const animate = (time) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const progress = Math.min((time - startTimeRef.current) / duration, 1);
      
      const current = Math.floor(startValue + (endValue - startValue) * progress);
      setDisplayValue(current);

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        startTimeRef.current = null;
      }
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [value]);

  return <span className={styles.balance}>{displayValue}</span>;
}
