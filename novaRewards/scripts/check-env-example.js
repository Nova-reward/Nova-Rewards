#!/usr/bin/env node
/**
 * check-env-example.js
 *
 * CI guard: verifies that every environment variable declared as required in
 * the backend validateEnv.js and the frontend Zod env schema is present in
 * novaRewards/.env.example.
 *
 * Usage:
 *   node novaRewards/scripts/check-env-example.js
 *
 * Exit codes:
 *   0 — all required variables are documented in .env.example
 *   1 — one or more variables are missing from .env.example
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths (relative to repo root)
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..');

const ENV_EXAMPLE_PATH = path.join(ROOT, 'novaRewards', '.env.example');
const BACKEND_VALIDATE_ENV_PATH = path.join(
  ROOT,
  'novaRewards',
  'backend',
  'middleware',
  'validateEnv.js'
);
const FRONTEND_ENV_SCHEMA_PATH = path.join(
  ROOT,
  'novaRewards',
  'frontend',
  'lib',
  'env.js'
);

// ---------------------------------------------------------------------------
// Parse .env.example — collect every key that appears as an assignment
// ---------------------------------------------------------------------------

function parseEnvExample(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const keys = new Set();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and blank lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)=/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Extract required backend variables from validateEnv.js
// ---------------------------------------------------------------------------

function parseBackendRequiredVars(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const vars = new Set();

  // Match array literals: ['VAR1', 'VAR2', ...]
  const arrayMatches = content.matchAll(/\[\s*((?:'[A-Z][A-Z0-9_]*'\s*,?\s*)+)\]/g);
  for (const match of arrayMatches) {
    const items = match[1].matchAll(/'([A-Z][A-Z0-9_]*)'/g);
    for (const item of items) vars.add(item[1]);
  }

  // Match individual process.env references: process.env.VAR_NAME
  const envMatches = content.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g);
  for (const match of envMatches) vars.add(match[1]);

  return vars;
}

// ---------------------------------------------------------------------------
// Extract required frontend variables from the Zod schema (env.js)
// ---------------------------------------------------------------------------

function parseFrontendRequiredVars(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const vars = new Set();

  // Match Zod object keys: NEXT_PUBLIC_VAR_NAME: z.string()...
  const keyMatches = content.matchAll(/^\s*(NEXT_PUBLIC_[A-Z][A-Z0-9_]*)\s*:/gm);
  for (const match of keyMatches) vars.add(match[1]);

  // Also catch any non-public keys defined in the schema
  const allKeyMatches = content.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:/gm);
  for (const match of allKeyMatches) {
    // Only include keys that look like env var names (all caps + underscores)
    if (/^[A-Z][A-Z0-9_]+$/.test(match[1])) vars.add(match[1]);
  }

  return vars;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  let hasErrors = false;

  // Load .env.example keys
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    console.error(`❌  .env.example not found at: ${ENV_EXAMPLE_PATH}`);
    process.exit(1);
  }
  const exampleKeys = parseEnvExample(ENV_EXAMPLE_PATH);
  console.log(`✔  Parsed ${exampleKeys.size} keys from .env.example\n`);

  // Check backend required vars
  if (fs.existsSync(BACKEND_VALIDATE_ENV_PATH)) {
    const backendVars = parseBackendRequiredVars(BACKEND_VALIDATE_ENV_PATH);
    const missingFromBackend = [...backendVars].filter((v) => !exampleKeys.has(v));
    if (missingFromBackend.length > 0) {
      console.error('❌  Backend required variables missing from .env.example:');
      missingFromBackend.forEach((v) => console.error(`     • ${v}`));
      hasErrors = true;
    } else {
      console.log(`✔  All ${backendVars.size} backend required variables are documented`);
    }
  } else {
    console.warn(`⚠   Backend validateEnv.js not found — skipping backend check`);
  }

  // Check frontend Zod schema vars
  if (fs.existsSync(FRONTEND_ENV_SCHEMA_PATH)) {
    const frontendVars = parseFrontendRequiredVars(FRONTEND_ENV_SCHEMA_PATH);
    const missingFromFrontend = [...frontendVars].filter((v) => !exampleKeys.has(v));
    if (missingFromFrontend.length > 0) {
      console.error('\n❌  Frontend Zod schema variables missing from .env.example:');
      missingFromFrontend.forEach((v) => console.error(`     • ${v}`));
      hasErrors = true;
    } else {
      console.log(`✔  All ${frontendVars.size} frontend Zod schema variables are documented`);
    }
  } else {
    console.warn(`⚠   Frontend env.js not found — skipping frontend check`);
  }

  if (hasErrors) {
    console.error(
      '\n❌  .env.example is out of sync. Add the missing variables and re-run this check.\n'
    );
    process.exit(1);
  } else {
    console.log('\n✅  .env.example is in sync with all env schemas.\n');
    process.exit(0);
  }
}

main();
