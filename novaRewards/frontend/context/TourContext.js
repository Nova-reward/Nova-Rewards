'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const TourContext = createContext(null);

const STORAGE_KEY = 'onboardingComplete';

/**
 * Provides onboarding tour state and controls to the app.
 */
export function TourProvider({ children }) {
  const [tourActive, setTourActive] = useState(false);

  /** Returns true if the user has already completed the tour. */
  const hasCompletedTour = useCallback(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }, []);

  /** Marks the tour as complete in localStorage. */
  const markTourComplete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    setTourActive(false);
  }, []);

  /** Starts the tour (used on first login or manual restart). */
  const startTour = useCallback(() => {
    setTourActive(true);
  }, []);

  /** Stops the tour without marking it complete (e.g. skip). */
  const stopTour = useCallback(() => {
    setTourActive(false);
  }, []);

  return (
    <TourContext.Provider value={{ tourActive, startTour, stopTour, markTourComplete, hasCompletedTour }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a TourProvider');
  return ctx;
}
