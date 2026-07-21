'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { jwtDecode } from 'jwt-decode';

/**
 * Hook to track JWT token expiry and trigger callbacks at specific times.
 * Includes inactivity detection (no user input in 5 minutes).
 *
 * @param {string} token - The JWT access token
 * @param {object} options
 * @param {number} options.warningThreshold - Minutes before expiry to show warning (default: 2)
 * @param {number} options.inactivityTimeout - Minutes of inactivity before disabling warning (default: 5)
 * @param {function} options.onWarning - Callback when warning should be shown
 * @param {function} options.onExpiry - Callback when token expires
 * @returns {object} { expiresAt, expiresIn, isExpired, isInactive }
 */
export function useTokenExpiry(token, options = {}) {
  const {
    warningThreshold = 2,
    inactivityTimeout = 5,
    onWarning,
    onExpiry,
  } = options;

  const [expiresAt, setExpiresAt] = useState(null);
  const [expiresIn, setExpiresIn] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isInactive, setIsInactive] = useState(false);

  const warningShownRef = useRef(false);
  const expiryTriggeredRef = useRef(false);
  const inactivityTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const eventListenerRef = useRef(null);

  // Decode token and set expiry time
  useEffect(() => {
    if (!token) {
      warningShownRef.current = false;
      expiryTriggeredRef.current = false;
      setExpiresAt(null);
      setExpiresIn(null);
      return;
    }

    try {
      const decoded = jwtDecode(token);
      if (decoded.exp) {
        const expireMs = decoded.exp * 1000;
        setExpiresAt(expireMs);
        setExpiresIn((expireMs - Date.now()) / 1000);
      }
    } catch (err) {
      console.warn('[useTokenExpiry] Failed to decode token:', err);
    }
  }, [token]);

  // Reset inactivity when user interacts
  const handleUserActivity = useCallback(() => {
    setIsInactive(false);

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Reset 5-minute inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      setIsInactive(true);
    }, inactivityTimeout * 60 * 1000);
  }, [inactivityTimeout]);

  // Attach activity listeners (throttled)
  useEffect(() => {
    const throttledActivityHandler = (() => {
      let lastCall = 0;
      return () => {
        const now = Date.now();
        if (now - lastCall > 1000) { // Throttle to 1 second
          lastCall = now;
          handleUserActivity();
        }
      };
    })();

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((event) => {
      document.addEventListener(event, throttledActivityHandler);
    });

    // Initialize first activity
    handleUserActivity();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledActivityHandler);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [handleUserActivity]);

  // Monitor token expiry countdown
  useEffect(() => {
    if (!expiresAt) return;

    const updateCountdown = () => {
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry <= 0) {
        // Token has expired
        setIsExpired(true);
        setExpiresIn(0);

        if (!expiryTriggeredRef.current) {
          expiryTriggeredRef.current = true;
          warningShownRef.current = false; // Reset warning flag
          onExpiry?.();
        }

        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
        return;
      }

      setExpiresIn(timeUntilExpiry / 1000);
      const minutesUntilExpiry = timeUntilExpiry / 1000 / 60;

      // Show warning 2 minutes before expiry (and user is active)
      if (
        minutesUntilExpiry <= warningThreshold &&
        !warningShownRef.current &&
        !isInactive
      ) {
        warningShownRef.current = true;
        onWarning?.();
      }

      // If user became inactive, don't show warning until they're active again
      if (isInactive && warningShownRef.current) {
        // Note: Warning is already shown, just maintaining state
      }
    };

    // Initial call
    updateCountdown();

    // Update every second
    countdownTimerRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [expiresAt, warningThreshold, onWarning, onExpiry, isInactive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  return {
    expiresAt,
    expiresIn,
    isExpired,
    isInactive,
  };
}
