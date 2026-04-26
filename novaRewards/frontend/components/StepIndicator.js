/**
 * StepIndicator component with animations and accessibility support
 */
export default function StepIndicator({ 
  steps = [], 
  currentStep = 0,
  orientation = 'horizontal',
  animated = true
}) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <nav 
      aria-label="Progress steps"
      className={`flex ${isHorizontal ? 'flex-row items-center' : 'flex-col'}`}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isUpcoming = index > currentStep;

        return (
          <div 
            key={index}
            className={`flex ${isHorizontal ? 'flex-row items-center' : 'flex-col'} ${index < steps.length - 1 ? 'flex-1' : ''}`}
          >
            <div className={`flex ${isHorizontal ? 'flex-col' : 'flex-row'} items-center`}>
              <div
                className={`
                  flex items-center justify-center rounded-full
                  ${isCompleted ? 'bg-green-600 text-white' : ''}
                  ${isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-200' : ''}
                  ${isUpcoming ? 'bg-gray-300 text-gray-600' : ''}
                  ${animated ? 'transition-all duration-300' : ''}
                  w-10 h-10 font-semibold
                `}
                role="img"
                aria-label={`Step ${index + 1}: ${step.label}${isCompleted ? ' completed' : isCurrent ? ' current' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className={`${isHorizontal ? 'mt-2 text-center' : 'ml-3'}`}>
                <div className={`text-sm font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-700'}`}>
                  {step.label}
                </div>
                {step.description && (
                  <div className="text-xs text-gray-500 mt-1">
                    {step.description}
                  </div>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div 
                className={`
                  ${isHorizontal ? 'h-0.5 w-full mx-4' : 'w-0.5 h-12 ml-5 my-2'}
                  ${isCompleted ? 'bg-green-600' : 'bg-gray-300'}
                  ${animated ? 'transition-colors duration-300' : ''}
                `}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
