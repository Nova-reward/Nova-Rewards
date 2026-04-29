import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign In' };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        Sign in to Nova Rewards
      </h1>
      {/* LoginForm client component goes here */}
    </>
  );
}
