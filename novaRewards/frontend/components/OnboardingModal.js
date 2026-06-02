'use client';

import { useEffect } from 'react';
import Modal from './modal/Modal';
import { useOnboardingStore } from '../store/onboardingStore';

const STEPS = [
  {
    title: 'Connect Your Wallet',
    description: 'Link your Freighter wallet to start using Nova Rewards.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    ),
  },
  {
    title: 'Explore Campaigns',
    description: 'Browse active reward campaigns from participating merchants.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
    ),
  },
  {
    title: 'Earn Tokens',
    description: 'Complete qualifying actions to receive NOVA tokens instantly.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z" />
    ),
  },
  {
    title: 'Redeem Rewards',
    description: 'Spend your NOVA tokens on exclusive rewards and discounts.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
];

/**
 * OnboardingModal — 4-step guided flow for new users.
 *
 * - Triggers automatically for users who have not completed/dismissed it.
 * - Steps: connect wallet → explore campaigns → earn tokens → redeem rewards.
 * - Users can skip at any step.
 * - Completion state persisted via onboardingStore (Zustand + localStorage).
 */
export default function OnboardingModal() {
  const {
    isOpen,
    isCompleted,
    isDismissed,
    currentStep,
    completedSteps,
    open,
    close,
    completeStep,
    dismiss,
    goToStep,
  } = useOnboardingStore();

  // Auto-trigger for users who haven't completed or dismissed
  useEffect(() => {
    if (!isCompleted && !isDismissed) open();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={dismiss}
      size="md"
      closeOnBackdrop={false}
      aria-describedby="onboarding-step-desc"
    >
      {/* Progress + skip row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2" role="list" aria-label="Onboarding progress">
          {STEPS.map((s, i) => (
            <div
              key={i}
              role="listitem"
              aria-label={`Step ${i + 1}: ${s.title}${completedSteps.includes(i) ? ' (completed)' : i === currentStep ? ' (current)' : ''}`}
              className={[
                'h-2 rounded-full transition-all',
                i === currentStep
                  ? 'w-8 bg-blue-600'
                  : completedSteps.includes(i)
                  ? 'w-2 bg-blue-400'
                  : 'w-2 bg-gray-300',
              ].join(' ')}
            />
          ))}
        </div>

        <button
          onClick={dismiss}
          className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
          aria-label="Skip onboarding"
        >
          Skip
        </button>
      </div>

      {/* Illustration */}
      <div
        className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4"
        aria-hidden="true"
      >
        <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {step.icon}
        </svg>
      </div>

      {/* Text */}
      <h2 className="text-xl font-bold text-center mb-1">{step.title}</h2>
      <p
        id="onboarding-step-desc"
        className="text-sm text-gray-600 text-center mb-6"
        aria-live="polite"
      >
        {step.description}
      </p>

      {/* Step counter */}
      <p className="text-xs text-gray-400 text-center mb-4">
        Step {currentStep + 1} of {STEPS.length}
      </p>

      {/* Navigation */}
      <div className="flex gap-3">
        {currentStep > 0 && (
          <button
            onClick={() => goToStep(currentStep - 1)}
            className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Back
          </button>
        )}
        <button
          onClick={() => completeStep(currentStep)}
          className={[
            currentStep === 0 ? 'w-full' : 'flex-1',
            'bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
          ].join(' ')}
          aria-label={isLast ? 'Finish onboarding' : 'Continue to next step'}
        >
          {isLast ? 'Get Started' : 'Continue'}
        </button>
      </div>
    </Modal>
  );
}
