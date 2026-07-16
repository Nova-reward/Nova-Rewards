import React from 'react';

export const Button = ({ variant = 'primary', size = 'md', children, className = '', ...props }) => {
  const baseStyle =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ' +
    'disabled:opacity-50 disabled:pointer-events-none';

  const variants = {
    primary:   'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400',
    secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600',
    outline:   'border border-neutral-300 bg-transparent hover:bg-neutral-100 text-neutral-900 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800',
    ghost:     'bg-transparent hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800',
    danger:    'bg-error-600 text-white hover:bg-error-700 dark:bg-error-600 dark:hover:bg-error-500',
  };

  const sizes = {
    sm: 'h-9 px-3 type-body-sm',
    md: 'h-10 px-4 py-2 type-body-sm',
    lg: 'h-11 px-8 type-body',
  };

  const classes = `${baseStyle} ${variants[variant] ?? variants.primary} ${sizes[size] ?? sizes.md} ${className}`;

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
};

export default Button;
