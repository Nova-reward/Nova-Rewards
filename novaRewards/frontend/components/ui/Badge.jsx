import React from 'react';

export const Badge = ({ variant = 'default', className = '', children, ...props }) => {
  const baseStyle = 'inline-flex items-center rounded-full border px-2.5 py-0.5 type-label transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2';

  const variants = {
    default:     'border-transparent bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400',
    secondary:   'border-transparent bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600',
    success:     'border-transparent bg-success-100 text-success-700 hover:bg-success-50 dark:bg-success-700/30 dark:text-success-500',
    warning:     'border-transparent bg-warning-100 text-warning-700 hover:bg-warning-50 dark:bg-warning-700/30 dark:text-warning-500',
    destructive: 'border-transparent bg-error-500 text-white hover:bg-error-600 dark:bg-error-600 dark:hover:bg-error-500',
    outline:     'border-neutral-300 text-neutral-900 dark:border-neutral-600 dark:text-neutral-100',
  };

  return (
    <div className={`${baseStyle} ${variants[variant] ?? variants.default} ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Badge;
