import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home',
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-primary-600">Nova Rewards</h1>
      <p className="mt-4 text-neutral-500">
        Blockchain-powered loyalty on the Stellar network.
      </p>
    </main>
  );
}
