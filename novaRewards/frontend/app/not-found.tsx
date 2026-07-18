import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '404 — Not Found' };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-6xl font-bold text-primary-600">404</h1>
      <p className="text-neutral-500">Page not found.</p>
      <Link href="/" className="text-primary-600 underline hover:text-primary-700">
        Go home
      </Link>
    </div>
  );
}
