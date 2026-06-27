import React from 'react';

export const Alert = ({ variant = 'default', className = '', children, ...props }) => {
  const baseStyle =
    'relative w-full rounded-lg border p-4 type-body-sm ' +
    '[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 ' +
    '[&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11';

  const variants = {
    default:     'bg-neutral-50 border-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100',
    info:        'bg-info-50 border-info-500/50 text-info-700 dark:bg-info-700/20 dark:border-info-500 dark:text-info-400 [&>svg]:text-info-500',
    success:     'bg-success-50 border-success-500/50 text-success-700 dark:bg-success-700/20 dark:border-success-500 dark:text-success-400 [&>svg]:text-success-500',
    warning:     'bg-warning-50 border-warning-500/50 text-warning-700 dark:bg-warning-700/20 dark:border-warning-500 dark:text-warning-400 [&>svg]:text-warning-500',
    destructive: 'bg-error-50 border-error-500/50 text-error-600 dark:bg-error-700/20 dark:border-error-500 dark:text-error-400 [&>svg]:text-error-500',
  };

  return (
    <div role="alert" className={`${baseStyle} ${variants[variant] ?? variants.default} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const AlertTitle = ({ className = '', ...props }) => (
  <h5 className={`mb-1 font-semibold leading-none tracking-tight ${className}`} {...props} />
);

export const AlertDescription = ({ className = '', ...props }) => (
  <div className={`type-body-sm [&_p]:leading-relaxed ${className}`} {...props} />
);
