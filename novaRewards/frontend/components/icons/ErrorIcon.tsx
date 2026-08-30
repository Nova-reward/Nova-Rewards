'use client';

import { ErrorType } from '@/lib/errorService';

interface ErrorIconProps {
  type: ErrorType;
  className?: string;
}

/**
 * Icon component for different error types
 */
export default function ErrorIcon({
  type,
  className = 'w-6 h-6',
}: ErrorIconProps): JSX.Element {
  const baseClasses = `${className} flex-shrink-0`;

  switch (type) {
    case 'not_found':
      return (
        <svg
          className={`${baseClasses} text-yellow-600 dark:text-yellow-400`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      );

    case 'unauthorized':
    case 'forbidden':
      return (
        <svg
          className={`${baseClasses} text-orange-600 dark:text-orange-400`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 1C6.48 1 2 5.48 2 11s4.48 10 10 10 10-4.48 10-10S17.52 1 12 1zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-13h4v6h-4z" />
        </svg>
      );

    case 'validation':
      return (
        <svg
          className={`${baseClasses} text-yellow-600 dark:text-yellow-400`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );

    case 'network':
      return (
        <svg
          className={`${baseClasses} text-blue-600 dark:text-blue-400`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
          />
        </svg>
      );

    case 'timeout':
      return (
        <svg
          className={`${baseClasses} text-orange-600 dark:text-orange-400`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" />
        </svg>
      );

    case 'server':
      return (
        <svg
          className={`${baseClasses} text-red-600 dark:text-red-400`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zm-3 8h-2V5h2v6z" />
        </svg>
      );

    case 'blockchain':
      return (
        <svg
          className={`${baseClasses} text-purple-600 dark:text-purple-400`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      );

    case 'wallet':
      return (
        <svg
          className={`${baseClasses} text-indigo-600 dark:text-indigo-400`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      );

    case 'unknown':
    default:
      return (
        <svg
          className={`${baseClasses} text-gray-600 dark:text-gray-400`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}
