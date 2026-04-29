import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Dashboard
      </h1>
    </section>
  );
}
