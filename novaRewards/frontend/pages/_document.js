import { Html, Head, Main, NextScript } from 'next/document';
import crypto from 'crypto';

export default function Document({ nonce }) {
  return (
    <Html lang="en">
      <Head nonce={nonce} />
      <body>
        <Main />
        <NextScript nonce={nonce} />
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
