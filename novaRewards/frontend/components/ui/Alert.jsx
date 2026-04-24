import React from 'react';

export const Alert = ({ variant = 'default', className = '', children, ...props }) => {
  const baseStyle = 'relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:text-foreground [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11';
  
  const variants = {
    default: 'bg-white text-gray-950',
    destructive: 'border-red-500/50 text-red-500 dark:border-red-500 [&>svg]:text-red-500',
    success: 'border-green-500/50 text-green-700 dark:border-green-500 [&>svg]:text-green-500',
  };

  return (
    <div role="alert" className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const AlertTitle = ({ className = '', ...props }) => (
  <h5 className={`mb-1 font-medium leading-none tracking-tight ${className}`} {...props} />
);

export const AlertDescription = ({ className = '', ...props }) => (
  <div className={`text-sm [&_p]:leading-relaxed ${className}`} {...props} />
);
