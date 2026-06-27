'use client';

import { useCallback } from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useTour } from '../context/TourContext';

/**
 * Tour steps targeting the four key platform areas.
 * Each target uses a data-tour attribute set on the corresponding element.
 */
const STEPS = [
  {
    target: '[data-tour="points-widget"]',
    title: '⭐ Your Points Balance',
    content:
      'This widget shows your current NOVA points in real time. Points update automatically as you earn and redeem rewards.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="reward-catalogue"]',
    title: '🎁 Reward Catalogue',
    content:
      'Browse and redeem available rewards here. New offers are added regularly — keep an eye out for limited-time deals.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour="referral-link"]',
    title: '👥 Referral Program',
    content:
      'Share your unique referral link with friends. Every successful referral earns you bonus NOVA points.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour="notification-centre"]',
    title: '🔔 Notification Centre',
    content:
      'Stay up to date with reward alerts, referral confirmations, and platform announcements right here.',
    placement: 'bottom',
    disableBeacon: true,
  },
];

/** Tooltip styles derived from the app design system CSS variables. */
const joyrideStyles = {
  options: {
    arrowColor: 'var(--surface)',
    backgroundColor: 'var(--surface)',
    overlayColor: 'rgba(0, 0, 0, 0.55)',
    primaryColor: 'var(--accent)',
    textColor: 'var(--text)',
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    padding: '1.25rem 1.5rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '0.9375rem',
    maxWidth: '340px',
  },
  tooltipTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    marginBottom: '0.5rem',
    color: 'var(--text)',
  },
  tooltipContent: {
    color: 'var(--muted)',
    lineHeight: '1.6',
  },
  buttonNext: {
    backgroundColor: 'var(--accent)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: '500',
    padding: '0.5rem 1rem',
    border: 'none',
  },
  buttonBack: {
    color: 'var(--accent)',
    fontSize: '0.875rem',
    fontWeight: '500',
    marginRight: '0.5rem',
    background: 'none',
    border: 'none',
  },
  buttonSkip: {
    color: 'var(--muted)',
    fontSize: '0.8125rem',
    background: 'none',
    border: 'none',
  },
  buttonClose: {
    color: 'var(--muted)',
  },
};

/**
 * Renders the react-joyride tour when tourActive is true.
 * Handles completion and skip by marking the tour done in localStorage.
 */
export default function OnboardingTour() {
  const { tourActive, markTourComplete, stopTour } = useTour();

  const handleCallback = useCallback(
    (data) => {
      const { action, status, type } = data;

      if (
        status === STATUS.FINISHED ||
        status === STATUS.SKIPPED ||
        action === ACTIONS.CLOSE
      ) {
        markTourComplete();
        return;
      }

      if (type === EVENTS.TOUR_END) {
        stopTour();
      }
    },
    [markTourComplete, stopTour]
  );

  if (!tourActive) return null;

  return (
    <Joyride
      steps={STEPS}
      run={tourActive}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableScrollParentFix
      callback={handleCallback}
      styles={joyrideStyles}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next',
        skip: 'Skip tour',
      }}
      aria-label="Platform onboarding tour"
    />
  );
}
