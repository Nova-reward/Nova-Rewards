import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-xs p-2 gap-1',
  md: 'text-sm p-3 gap-2',
  lg: 'text-base p-4 gap-3',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  onRetry,
  size = 'md',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex items-center rounded-lg bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-200 ${sizeClasses[size]}`}
    >
      <AlertCircle className={`flex-shrink-0 ${iconSizes[size]}`} />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 p-1"
          aria-label="Retry"
        >
          <RefreshCw className={`${iconSizes[size]}`} />
        </button>
      )}
    </motion.div>
  );
};

export default InlineError;
