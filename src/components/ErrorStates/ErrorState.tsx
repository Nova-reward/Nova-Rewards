import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, WifiOff, Server, RefreshCw, HelpCircle } from 'lucide-react';
import { ErrorType } from '@/types/errors';

export interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  onRetry?: () => void;
  showRetry?: boolean;
  statusCode?: number;
}

const errorConfig = {
  network: {
    icon: WifiOff,
    defaultTitle: 'Connection Error',
    defaultMessage: 'Unable to connect to the server. Please check your internet connection.',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-800 dark:text-orange-200',
    iconColor: 'text-orange-500',
  },
  server: {
    icon: Server,
    defaultTitle: 'Server Error',
    defaultMessage: 'Something went wrong on our end. Please try again later.',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-800 dark:text-red-200',
    iconColor: 'text-red-500',
  },
  client: {
    icon: AlertCircle,
    defaultTitle: 'Request Error',
    defaultMessage: 'There was a problem with your request. Please try again.',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    textColor: 'text-yellow-800 dark:text-yellow-200',
    iconColor: 'text-yellow-500',
  },
  unknown: {
    icon: HelpCircle,
    defaultTitle: 'Unexpected Error',
    defaultMessage: 'An unexpected error occurred. Please try again.',
    bgColor: 'bg-gray-50 dark:bg-gray-950/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
    textColor: 'text-gray-800 dark:text-gray-200',
    iconColor: 'text-gray-500',
  },
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = 'unknown',
  title,
  message,
  onRetry,
  showRetry = true,
  statusCode,
}) => {
  const config = errorConfig[type];
  const Icon = config.icon;
  
  const displayTitle = title || config.defaultTitle;
  let displayMessage = message || config.defaultMessage;
  
  if (statusCode && type === 'server') {
    displayMessage = `Server error ${statusCode}. ${displayMessage}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg border p-8 text-center ${config.bgColor} ${config.borderColor}`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className={`rounded-full p-3 ${config.bgColor}`}>
          <Icon className={`h-8 w-8 ${config.iconColor}`} />
        </div>
        
        <div>
          <h3 className={`mb-2 text-lg font-semibold ${config.textColor}`}>
            {displayTitle}
          </h3>
          <p className={`text-sm ${config.textColor} opacity-80`}>
            {displayMessage}
          </p>
        </div>
        
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default ErrorState;
