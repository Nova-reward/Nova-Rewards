import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Nova Rewards',
    template: '%s | Nova Rewards',
  },
  description: 'Blockchain-powered loyalty rewards on the Stellar network.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: 'Nova Rewards',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
