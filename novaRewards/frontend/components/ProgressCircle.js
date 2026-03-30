/**
 * ProgressCircle component with animations and accessibility support
 */
export default function ProgressCircle({ 
  value = 0, 
  max = 100, 
  size = 120,
  strokeWidth = 8,
  label = '',
  showPercentage = true,
  variant = 'default',
  animated = true
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const variantColors = {
    default: '#2563eb',
    success: '#16a34a',
    warning: '#ca8a04',
    error: '#dc2626'
  };

  return (
    <div className="inline-flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className={animated ? 'transition-all duration-500' : ''}
          role="img"
          aria-label={`${label || 'Progress'}: ${Math.round(percentage)}%`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={variantColors[variant]}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className={animated ? 'transition-all duration-500 ease-out' : ''}
          />
        </svg>
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-semibold text-gray-700">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
      {label && (
        <span className="mt-2 text-sm text-gray-600">{label}</span>
      )}
    </div>
  );
}
