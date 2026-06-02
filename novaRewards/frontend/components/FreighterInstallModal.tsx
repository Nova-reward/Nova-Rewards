'use client';

import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface FreighterInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * FreighterInstallModal
 *
 * Displays a user-friendly prompt to install the Freighter browser extension
 * when `isFreighterInstalled()` returns false.
 */
export default function FreighterInstallModal({ isOpen, onClose }: FreighterInstallModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="freighter-install-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-brand-dark dark:border dark:border-brand-border">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          aria-label="Close install prompt"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
            <Download className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2
              id="freighter-install-title"
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              Freighter Not Detected
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Install the extension to connect your wallet
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Freighter is a secure Stellar wallet browser extension. It looks like
              you don&apos;t have it installed yet.
            </p>
          </div>

          <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary-500" />
              Securely store your Stellar assets
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary-500" />
              Sign transactions without exposing your keys
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary-500" />
              Available for Chrome, Firefox, and Brave
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">
          <a
            href="https://www.freighter.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
          >
            Install Freighter
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors dark:border-brand-border dark:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            I&apos;ll install it later
          </button>
        </div>
      </div>
    </div>
  );
}

