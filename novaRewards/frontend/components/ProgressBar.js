/**
 * ProgressBar component with animations and accessibility support
 */
export default function ProgressBar({ 
  value = 0, 
  max = 100, 
  label = '', 
  showLabel = true,
  variant = 'default',
  size = 'md',
  animated = true 
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const variantClasses = {
    default: 'bg-primary-600',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
    error:   'bg-error-600',
  };

  return (
    <div className="w-full">
      {showLabel && label && (
        <div className="flex justify-between mb-1">
          <span className="type-body-sm text-neutral-700 dark:text-neutral-300">{label}</span>
          <span className="type-body-sm text-neutral-600 dark:text-neutral-400">{Math.round(percentage)}%</span>
        </div>
      )}
      <div 
        className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'Progress'}
      >
        <div
          className={`h-full ${variantClasses[variant]} ${animated ? 'transition-all duration-500 ease-out' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
