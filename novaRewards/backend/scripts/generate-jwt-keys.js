#!/usr/bin/env node
/**
 * generate-jwt-keys.js — Issue #648
 *
 * Generates a 2048-bit RSA key pair for RS256 JWT signing.
 * Outputs the keys as single-line env vars (newlines escaped as \n).
 *
 * Usage:
 *   node scripts/generate-jwt-keys.js
 *
 * Then copy the output into your .env file.
 * NEVER commit the private key.
 */
const { generateKeyPairSync } = require('crypto');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const escape = (pem) => pem.replace(/\n/g, '\\n');

console.log('# Add these to your .env file (never commit the private key)\n');
console.log(`JWT_PRIVATE_KEY="${escape(privateKey)}"`);
console.log(`JWT_PUBLIC_KEY="${escape(publicKey)}"`);
