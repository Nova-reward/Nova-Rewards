import Modal from './modal/Modal';
import { useOnboardingStore } from '../store/onboardingStore';

const STEPS = [
  {
    title: 'Connect Your Wallet',
    description: 'Link your Freighter wallet to start earning NOVA tokens.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    ),
    skippable: false,
  },
  {
    title: 'Create Your Profile',
    description: 'Set a display name and avatar so merchants can recognise you.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    ),
    skippable: true,
  },
  {
    title: 'Explore Campaigns',
    description: 'Browse active reward campaigns from participating merchants.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
    ),
    skippable: true,
  },
  {
    title: 'Earn Your First Reward',
    description: 'Complete a qualifying action to receive your welcome NOVA tokens.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z" />
    ),
    skippable: false,
  },
];

/**
 * OnboardingModal — 4-step guided flow rendered inside the base Modal portal.
 * Progress is driven by onboardingStore (Zustand + localStorage).
 */
export default function OnboardingModal() {
  const { isOpen, currentStep, completedSteps, close, completeStep, dismiss, goToStep } =
    useOnboardingStore();

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const isStepDone = completedSteps.includes(currentStep);

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="md"
      closeOnBackdrop={false}
      aria-describedby="onboarding-desc"
    >
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-6" role="list" aria-label="Onboarding progress">
        {STEPS.map((s, i) => (
          <button
            key={i}
            role="listitem"
            aria-label={`Step ${i + 1}: ${s.title}${completedSteps.includes(i) ? ' (completed)' : i === currentStep ? ' (current)' : ''}`}
            onClick={() => completedSteps.includes(i) && goToStep(i)}
            className={[
              'h-2 rounded-full transition-all focus:outline-none',
              i === currentStep ? 'w-8 bg-blue-600' : completedSteps.includes(i) ? 'w-2 bg-blue-400' : 'w-2 bg-gray-300',
              completedSteps.includes(i) ? 'cursor-pointer' : 'cursor-default',
            ].join(' ')}
          />
        ))}

        {step.skippable && (
          <button
            onClick={dismiss}
            className="text-sm text-gray-500 hover:text-gray-700 ml-4 focus:outline-none focus:underline"
            aria-label="Skip onboarding"
          >
            Skip
          </button>
        )}
      </div>

      {/* Illustration */}
      <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4" aria-hidden="true">
        <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {step.icon}
        </svg>
      </div>

      {/* Content */}
      <h2 className="text-xl font-bold text-center mb-1">{step.title}</h2>
      <p id="onboarding-desc" className="text-sm text-gray-600 text-center mb-6">
        {step.description}
      </p>

      {/* Step counter */}
      <p className="text-xs text-gray-400 text-center mb-4" aria-live="polite">
        Step {currentStep + 1} of {STEPS.length}
      </p>

      {/* Actions */}
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
          disabled={isStepDone && !isLast}
          className={[
            currentStep === 0 ? 'w-full' : 'flex-1',
            'bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50',
          ].join(' ')}
          aria-label={isLast ? 'Finish onboarding' : 'Continue to next step'}
        >
          {isLast ? 'Finish' : 'Continue'}
        </button>
      </div>
    </Modal>
  );
}
