import React from 'react';

const variantStyles = {
  default:
    'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm',
  interactive:
    'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm ' +
    'cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 ' +
    'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2',
  highlighted:
    'bg-primary-50 dark:bg-primary-950 border border-primary-300 dark:border-primary-700 shadow-md',
};

/**
 * Card — unified card component with default, interactive, and highlighted variants.
 *
 * @param {'default'|'interactive'|'highlighted'} variant
 * @param {string} className
 * @param {React.ReactNode} children
 */
export function Card({ variant = 'default', className = '', ...props }) {
  return (
    <div
      className={`rounded-xl p-0 ${variantStyles[variant] ?? variantStyles.default} ${className}`}
      {...props}
    />
  );
}

export function CardHeader({ className = '', ...props }) {
  return (
    <div className={`flex flex-col space-y-1.5 px-6 pt-6 pb-0 ${className}`} {...props} />
  );
}

export function CardTitle({ className = '', ...props }) {
  return (
    <h3 className={`type-h6 text-neutral-900 dark:text-neutral-50 ${className}`} {...props} />
  );
}

export function CardBody({ className = '', ...props }) {
  return (
    <div className={`px-6 py-4 ${className}`} {...props} />
  );
}

/** Alias for CardBody to satisfy "content slot" naming convention. */
export const CardContent = CardBody;

export function CardFooter({ className = '', ...props }) {
  return (
    <div className={`flex items-center px-6 pb-6 pt-0 ${className}`} {...props} />
  );
}

export default Card;
