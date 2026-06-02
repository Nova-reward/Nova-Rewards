import { useState } from 'react';

/**
 * CopyButton Component
 * Reusable copy-to-clipboard button with visual feedback
 * 
 * Closes #848
 */
export default function CopyButton({ value, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for older browsers
        const input = document.createElement('input');
        input.value = value;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`btn btn-sm ${copied ? 'btn-success' : 'btn-secondary'} ${className}`}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
    >
      {copied ? '✓ Copied!' : label}
    </button>
  );
}
