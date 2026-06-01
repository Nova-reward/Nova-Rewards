import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create Account' };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        Create your account
      </h1>
      {/* RegisterForm client component goes here */}
    </>
  );
}
