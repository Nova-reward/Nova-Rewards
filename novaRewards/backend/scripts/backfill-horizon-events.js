#!/usr/bin/env node
'use strict';

/**
 * Horizon event backfill script.
 * Fetches historical contract events from a given ledger sequence and indexes them.
 *
 * Usage:
 *   node scripts/backfill-horizon-events.js --from-ledger=<ledger> [--contract=<id>]
 *
 * Requirements: #657
 */

require('dotenv').config({ path: '../.env' });

const { StellarSdk } = require('stellar-sdk');
const {
  recordContractEvent,
  markEventProcessed,
  markEventFailed,
  saveStreamCursor,
} = require('../db/contractEventRepository');
const {
  HORIZON_URL,
  NOVA_TOKEN_CONTRACT_ID,
  REWARD_POOL_CONTRACT_ID,
} = require('../services/configService');

const VALID_TYPES = ['mint', 'claim', 'stake', 'unstake'];
const PAGE_LIMIT = 200;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v];
    })
  );
  return {
    fromLedger: parseInt(args['from-ledger'] || '0', 10),
    contractId: args['contract'] || null,
  };
}

function extractEventType(record) {
  if (Array.isArray(record.topic)) {
    for (const topic of record.topic) {
      try {
        const decoded = StellarSdk.xdr.ScVal.fromXDR(topic, 'base64');
        if (decoded.switch().name === 'scvSymbol') {
          const name = decoded.sym().toString().toLowerCase();
          if (VALID_TYPES.includes(name)) return name;
        }
      } catch {
        const plain = String(topic).toLowerCase();
        if (VALID_TYPES.includes(plain)) return plain;
      }
    }
  }
  const plain = (record.type || record.event_type || '').toLowerCase();
  return VALID_TYPES.includes(plain) ? plain : null;
}

async function backfillContract(server, contractId, fromLedger) {
  console.log(`[backfill] Starting backfill for ${contractId} from ledger ${fromLedger}`);

  let cursor = fromLedger > 0 ? String(fromLedger * 4096) : '0';
  let processed = 0;
  let skipped = 0;

  while (true) {
    let page;
    try {
      page = await server
        .operations()
        .cursor(cursor)
        .limit(PAGE_LIMIT)
        .order('asc')
        .call();
    } catch (err) {
      console.error(`[backfill] Horizon fetch error at cursor ${cursor}:`, err.message);
      break;
    }

    const records = page.records || [];
    if (records.length === 0) break;

    for (const record of records) {
      const eventType = extractEventType(record);
      if (!eventType) {
        skipped++;
        continue;
      }

      try {
        const ev = await recordContractEvent({
          contractId,
          eventType,
          eventData: record,
          transactionHash: record.transaction_hash || record.tx_hash,
          ledgerSequence: record.ledger || record.ledger_sequence,
        });
        await markEventProcessed(ev.id);
        processed++;
      } catch (err) {
        console.error(`[backfill] Failed to store event:`, err.message);
      }
    }

    // Persist cursor after each page
    const lastRecord = records[records.length - 1];
    if (lastRecord?.paging_token) {
      cursor = lastRecord.paging_token;
      await saveStreamCursor(contractId, cursor);
    }

    console.log(`[backfill] Page done — processed=${processed} skipped=${skipped} cursor=${cursor}`);

    // If we got fewer records than the limit, we've reached the end
    if (records.length < PAGE_LIMIT) break;
  }

  console.log(`[backfill] Finished ${contractId}: processed=${processed} skipped=${skipped}`);
}

async function main() {
  const { fromLedger, contractId } = parseArgs();

  if (!fromLedger && fromLedger !== 0) {
    console.error('Usage: node backfill-horizon-events.js --from-ledger=<ledger> [--contract=<id>]');
    process.exit(1);
  }

  const server = new StellarSdk.Horizon.Server(HORIZON_URL);
  const contracts = contractId
    ? [contractId]
    : [NOVA_TOKEN_CONTRACT_ID, REWARD_POOL_CONTRACT_ID].filter(Boolean);

  for (const cid of contracts) {
    await backfillContract(server, cid, fromLedger);
  }

  console.log('[backfill] All contracts backfilled.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
