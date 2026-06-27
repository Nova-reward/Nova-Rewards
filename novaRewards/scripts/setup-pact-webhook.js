#!/usr/bin/env node
'use strict';

/**
 * setup-pact-webhook.js
 *
 * One-time setup script that registers a webhook on the Pact Broker so that
 * whenever a new consumer contract is published, the broker fires a
 * repository_dispatch event to GitHub Actions, triggering the
 * `provider-verify` CI job automatically.
 *
 * Required environment variables:
 *   PACT_BROKER_URL    — Base URL of the self-hosted Pact Broker
 *                        e.g. https://pact.novarewards.io
 *   PACT_BROKER_TOKEN  — Bearer token for Pact Broker authentication
 *   GITHUB_TOKEN       — GitHub Personal Access Token (PAT) with
 *                        `repo` scope, used to trigger repository_dispatch
 *   GITHUB_REPO        — GitHub repository in "owner/repo" format
 *                        e.g. nova-rewards/nova-rewards
 *
 * Usage:
 *   PACT_BROKER_URL=https://pact.novarewards.io \
 *   PACT_BROKER_TOKEN=<token> \
 *   GITHUB_TOKEN=<pat> \
 *   GITHUB_REPO=nova-rewards/nova-rewards \
 *   node novaRewards/scripts/setup-pact-webhook.js
 *
 * Requirements: 3.6
 */

const https = require('https');
const url = require('url');

// ── Validate required environment variables ────────────────────────────────

const REQUIRED_ENV = ['PACT_BROKER_URL', 'PACT_BROKER_TOKEN', 'GITHUB_TOKEN', 'GITHUB_REPO'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[setup-pact-webhook] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const PACT_BROKER_URL = process.env.PACT_BROKER_URL.replace(/\/$/, '');
const PACT_BROKER_TOKEN = process.env.PACT_BROKER_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // e.g. "nova-rewards/nova-rewards"

// ── Webhook payload ────────────────────────────────────────────────────────

const webhookBody = {
  description: 'Trigger provider verification on contract_published',
  events: [
    { name: 'contract_published' },
    { name: 'contract_requiring_verification_published' },
  ],
  request: {
    method: 'POST',
    url: `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'pact-broker-webhook',
    },
    body: JSON.stringify({
      event_type: 'pact-provider-verify',
      client_payload: {
        pact_url: '${pactbroker.pactUrl}',
        consumer_version: '${pactbroker.consumerVersionNumber}',
        provider: '${pactbroker.providerName}',
      },
    }),
  },
};

// ── HTTP helper ────────────────────────────────────────────────────────────

function httpsRequest(method, requestUrl, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(requestUrl);
    const bodyStr = body ? JSON.stringify(body) : '';

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('[setup-pact-webhook] Registering Pact Broker webhook...');
  console.log(`  Broker URL : ${PACT_BROKER_URL}`);
  console.log(`  GitHub repo: ${GITHUB_REPO}`);

  const webhookUrl = `${PACT_BROKER_URL}/webhooks`;

  let response;
  try {
    response = await httpsRequest(
      'POST',
      webhookUrl,
      webhookBody,
      {
        Authorization: `Bearer ${PACT_BROKER_TOKEN}`,
        Accept: 'application/hal+json',
      }
    );
  } catch (err) {
    console.error('[setup-pact-webhook] Request failed:', err.message);
    process.exit(1);
  }

  if (response.status === 200 || response.status === 201) {
    console.log('[setup-pact-webhook] Webhook registered successfully.');
    if (response.body && response.body._links && response.body._links.self) {
      console.log(`  Webhook URL: ${response.body._links.self.href}`);
    }
  } else {
    console.error(`[setup-pact-webhook] Unexpected response status: ${response.status}`);
    console.error(JSON.stringify(response.body, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[setup-pact-webhook] Unhandled error:', err);
  process.exit(1);
});
