import { Html, Head, Main, NextScript } from 'next/document';
import crypto from 'crypto';

export default function Document({ nonce }) {
  return (
    <Html lang="en">
      <Head nonce={nonce} />
      <body>
        <Main />
        <NextScript nonce={nonce} />

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <meta name="application-name" content="Nova Rewards" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NovaRewards" />
        <meta name="description" content="Stellar-based rewards and loyalty platform" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#4F46E5" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

Document.getInitialProps = async (ctx) => {
  const nonce = crypto.randomBytes(16).toString('base64');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const horizonUrl = process.env.NEXT_PUBLIC_HORIZON_URL || '';

  // Build CSP — nonce allows only explicitly tagged inline scripts
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'unsafe-inline'`,   // Next.js injects critical CSS inline
    `img-src 'self' data: https:`,
    `font-src 'self'`,
    `connect-src 'self' ${apiUrl} ${horizonUrl} https://horizon-testnet.stellar.org https://horizon.stellar.org`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ]
    .join('; ')
    .trim();

  ctx.res?.setHeader('Content-Security-Policy', csp);

  const initialProps = await ctx.defaultGetInitialProps(ctx);
  return { ...initialProps, nonce };
};
