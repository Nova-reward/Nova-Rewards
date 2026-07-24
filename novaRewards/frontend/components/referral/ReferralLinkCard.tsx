'use client';

import React from 'react';
import { useReferral } from '../../hooks/useReferral';

interface ReferralLinkCardProps {
  userId: string | number | null | undefined;
  className?: string;
}

/**
 * ReferralLinkCard — displays the user's referral link with copy-to-clipboard
 * and native share / social share buttons.
 *
 * Accessible: full keyboard navigation, aria labels, focus-visible rings.
 * Dark-mode aware via Tailwind dark: variants.
 */
export function ReferralLinkCard({ userId, className = '' }: ReferralLinkCardProps) {
  const { referralUrl, isLoading, error, copyLink, copied } = useReferral(userId);

  const handleNativeShare = async () => {
    if (!navigator?.share) return;
    try {
      await navigator.share({
        title: 'Join Nova Rewards!',
        text: 'Earn tokenized rewards on the Stellar network. Use my referral link:',
        url: referralUrl,
      });
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') console.error('Share failed', e);
    }
  };

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading referral link"
        className={`animate-pulse rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-800 ${className}`}
      >
        <div className="mb-3 h-3 w-1/3 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="mb-2 h-10 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-20 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Referral link"
      className={`rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 ${className}`}
    >
      <h2 className="mb-1 text-base font-semibold text-neutral-800 dark:text-neutral-100">
        Your referral link
      </h2>
      <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
        Share this link — you earn NOVA tokens for every friend who joins.
      </p>

      {/* Link input + copy button */}
      <div className="mb-4 flex items-center gap-2">
        <input
          readOnly
          value={referralUrl}
          aria-label="Referral URL"
          onClick={(e) => (e.target as HTMLInputElement).select()}
          onFocus={(e) => (e.target as HTMLInputElement).select()}
          className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200"
        />
        <button
          type="button"
          onClick={copyLink}
          aria-label={copied ? 'Link copied!' : 'Copy referral link'}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${
            copied
              ? 'bg-green-500 text-white'
              : 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400'
          }`}
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Social share buttons */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Share on social media">
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent('Join me on Nova Rewards and earn NOVA tokens!')}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X (Twitter)"
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          𝕏 Twitter
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Join Nova Rewards: ${referralUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on WhatsApp"
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          WhatsApp
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent('Join Nova Rewards!')}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on Telegram"
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          Telegram
        </a>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            type="button"
            onClick={handleNativeShare}
            aria-label="More share options"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            More…
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          {error}
        </p>
      )}
    </section>
  );
}

export default ReferralLinkCard;
