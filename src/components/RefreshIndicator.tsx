import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RefreshIndicatorProps {
  isRefreshing: boolean;
  lastUpdated: Date | null;
}

export const RefreshIndicator: React.FC<RefreshIndicatorProps> = ({
  isRefreshing,
  lastUpdated,
}) => {
  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;
    
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    
    return date.toLocaleTimeString();
  };

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <AnimatePresence mode="wait">
        {isRefreshing ? (
          <motion.div
            key="spinner"
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ opacity: 1, rotate: 360 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
            className="h-3 w-3 rounded-full border-2 border-green-500 border-t-transparent"
          />
        ) : (
          <motion.div
            key="check"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="text-green-500"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
      <span>Updated {formatLastUpdated(lastUpdated)}</span>
    </div>
  );
};

export default RefreshIndicator;
