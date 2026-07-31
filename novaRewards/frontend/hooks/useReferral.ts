'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ReferralStats {
  totalReferrals: number;
  pendingReferrals: number;
  confirmedReferrals: number;
  tokensEarned: number;
}

interface UseReferralReturn {
  referralCode: string;
  referralUrl: string;
  stats: ReferralStats | null;
  isLoading: boolean;
  error: string | null;
  copyLink: () => Promise<boolean>;
  copied: boolean;
  refresh: () => void;
}

const DEFAULT_STATS: ReferralStats = {
  totalReferrals: 0,
  pendingReferrals: 0,
  confirmedReferrals: 0,
  tokensEarned: 0,
};

/**
 * useReferral — fetches the user's referral code and stats, exposes copy helper.
 *
 * @param userId - The authenticated user's ID
 * @param apiBase - Backend base URL (defaults to NEXT_PUBLIC_API_URL)
 */
export function useReferral(
  userId: string | number | null | undefined,
  apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
): UseReferralReturn {
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const referralUrl = referralCode ? `${origin}/register?ref=${referralCode}` : '';

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const token =
      typeof window !== 'undefined'
        ? (() => {
            try {
              const stored = localStorage.getItem('nova-auth-storage');
              return stored ? JSON.parse(stored)?.state?.token ?? '' : '';
            } catch {
              return '';
            }
          })()
        : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${apiBase}/api/v1/users/${userId}/referral`, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json?.data ?? json;
      })
      .then((data) => {
        if (cancelled) return;
        setReferralCode(data.code ?? data.referralCode ?? String(userId).slice(-6).toUpperCase());
        setStats({
          totalReferrals: data.totalReferrals ?? 0,
          pendingReferrals: data.pendingReferrals ?? 0,
          confirmedReferrals: data.confirmedReferrals ?? data.totalReferrals ?? 0,
          tokensEarned: data.tokensEarned ?? data.pointsEarned ?? 0,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[useReferral] fetch failed, using fallback', err.message);
        // Use a deterministic fallback so the UI is still usable
        setReferralCode(`NOVA-${String(userId).slice(-6).toUpperCase()}`);
        setStats(DEFAULT_STATS);
        setError('Could not load referral data. Showing placeholder.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, apiBase, refreshKey]);

  const copyLink = useCallback(async (): Promise<boolean> => {
    if (!referralUrl) return false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralUrl);
      } else {
        // Fallback for older browsers
        const el = document.createElement('textarea');
        el.value = referralUrl;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return true;
    } catch {
      return false;
    }
  }, [referralUrl]);

  return { referralCode, referralUrl, stats, isLoading, error, copyLink, copied, refresh };
}
