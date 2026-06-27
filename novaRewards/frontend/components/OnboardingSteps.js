import { useState } from 'react';

/**
 * Multi-step onboarding component
 */
export default function OnboardingSteps({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to NovaRewards',
      description: 'Your blockchain-powered loyalty program',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
      content: 'Earn NOVA tokens for purchases and redeem them for rewards. All transactions are secure and transparent on the Stellar blockchain.'
    },
    {
      title: 'Connect Your Wallet',
      description: 'Use Freighter to manage your rewards',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      ),
      content: 'Freighter is a secure browser extension wallet for Stellar. Install it to safely store and manage your NOVA rewards.'
    },
    {
      title: 'Start Earning',
      description: 'Get rewards for every purchase',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      ),
      content: 'Shop at participating merchants and automatically earn NOVA tokens. Track your balance and transaction history in real-time.'
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex space-x-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 rounded-full transition-all ${
                      index === currentStep 
                        ? 'w-8 bg-blue-600' 
                        : index < currentStep 
                        ? 'w-2 bg-blue-400' 
                        : 'w-2 bg-gray-300'
                    }`}
                    aria-label={`Step ${index + 1}${index === currentStep ? ' (current)' : index < currentStep ? ' (completed)' : ''}`}
                  />
                ))}
              </div>
              <button
                onClick={handleSkip}
                className="text-sm text-gray-500 hover:text-gray-700"
                aria-label="Skip onboarding"
              >
                Skip
              </button>
            </div>

            <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {steps[currentStep].icon}
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              {steps[currentStep].title}
            </h2>
            <p className="text-sm text-gray-600 text-center mb-6">
              {steps[currentStep].description}
            </p>
            <p className="text-gray-700 text-center leading-relaxed">
              {steps[currentStep].content}
            </p>
          </div>

          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                aria-label="Previous step"
              >
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className={`${currentStep === 0 ? 'w-full' : 'flex-1'} bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              aria-label={currentStep === steps.length - 1 ? 'Complete onboarding' : 'Next step'}
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
