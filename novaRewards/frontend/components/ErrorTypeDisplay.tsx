'use client';

import { ErrorType } from '@/lib/errorService';

interface ErrorTypeDisplayProps {
  type: ErrorType;
}

/**
 * Display user-friendly error type title
 */
export default function ErrorTypeDisplay({
  type,
}: ErrorTypeDisplayProps): JSX.Element {
  const titles: Record<ErrorType, string> = {
    not_found: 'Page Not Found',
    unauthorized: 'Authentication Required',
    forbidden: 'Access Denied',
    validation: 'Invalid Input',
    network: 'Connection Error',
    timeout: 'Request Timeout',
    server: 'Server Error',
    blockchain: 'Blockchain Error',
    wallet: 'Wallet Error',
    unknown: 'Something Went Wrong',
  };

  return <>{titles[type]}</>;
}
