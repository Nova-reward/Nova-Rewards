'use strict';
const logger = require('./lib/logger');

/**
 * Horizon SSE event streaming and indexing service.
 * Connects to Horizon's /events endpoint, parses XDR contract events,
 * persists them to PostgreSQL, and manages cursor + reconnection.
 * Requirements: #657
 */

const { StellarSdk } = require('stellar-sdk');
const {
  recordContractEvent,
  markEventProcessed,
  markEventFailed,
  getPendingEvents,
  getStreamCursor,
  saveStreamCursor,
} = require('../db/contractEventRepository');
const {
  HORIZON_URL,
  NOVA_TOKEN_CONTRACT_ID,
  REWARD_POOL_CONTRACT_ID,
} = require('./configService');

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 60_000;
const RETRY_LOOP_INTERVAL_MS = 60_000;
const MAX_RETRIES = 5;

/** Active EventSource handles keyed by contractId */
const activeStreams = new Map();

/**
 * Starts the Horizon SSE stream for all configured contracts
 * and the failed-event retry loop.
 */
async function startEventListener() {
  const contracts = [NOVA_TOKEN_CONTRACT_ID, REWARD_POOL_CONTRACT_ID].filter(Boolean);
  for (const contractId of contracts) {
    await connectStream(contractId, 0);
  }
  startRetryLoop();
}

/**
 * Connects (or reconnects) the SSE stream for a single contract.
 * @param {string} contractId
 * @param {number} attempt - reconnect attempt count (for backoff)
 */
async function connectStream(contractId, attempt) {
  // Load persisted cursor so we resume from where we left off
  const cursor = (await getStreamCursor(contractId)) || 'now';

  const url = `${HORIZON_URL}/events?contract_id=${contractId}&cursor=${cursor}&limit=200`;

  logger.info(`[horizon-stream] Connecting to ${url} (attempt ${attempt})`);

  // Use Node's built-in fetch (Node 18+) or fall back to http.get for SSE
  let es;
  try {
    es = new EventSource(url);
  } catch {
    // EventSource not available in Node — use manual SSE via http
    es = createNodeSSE(url, contractId, attempt);
    return;
  }

  activeStreams.set(contractId, es);

  es.onmessage = async (event) => {
    try {
      const raw = JSON.parse(event.data);
      await handleRawEvent(contractId, raw);
      // Persist cursor after each successful event
      if (raw.paging_token) {
        await saveStreamCursor(contractId, raw.paging_token);
      }
    } catch (err) {
      logger.error(`[horizon-stream] Error handling event for ${contractId}:`, err.message);
    }
  };

  es.onerror = () => {
    logger.warn(`[horizon-stream] Stream error for ${contractId}, scheduling reconnect`);
    es.close();
    activeStreams.delete(contractId);
    scheduleReconnect(contractId, attempt + 1);
  };
}

/**
 * Manual SSE client for Node.js environments without EventSource.
 * Uses the stellar-sdk Horizon server's streaming API.
 */
function createNodeSSE(url, contractId, attempt) {
  const server = new StellarSdk.Horizon.Server(HORIZON_URL);

  const closeHandler = server
    .operations()
    .cursor('now')
    .stream({
      onmessage: async (record) => {
        try {
          await handleRawEvent(contractId, record);
          if (record.paging_token) {
            await saveStreamCursor(contractId, record.paging_token);
          }
        } catch (err) {
          logger.error(`[horizon-stream] Error handling record for ${contractId}:`, err.message);
        }
      },
      onerror: (err) => {
        logger.warn(`[horizon-stream] SDK stream error for ${contractId}:`, err?.message);
        if (typeof closeHandler === 'function') closeHandler();
        activeStreams.delete(contractId);
        scheduleReconnect(contractId, attempt + 1);
      },
    });

  activeStreams.set(contractId, { close: closeHandler });
  return closeHandler;
}

/**
 * Schedules a reconnect with exponential backoff.
 * @param {string} contractId
 * @param {number} attempt
 */
function scheduleReconnect(contractId, attempt) {
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
  logger.info(`[horizon-stream] Reconnecting ${contractId} in ${delay}ms (attempt ${attempt})`);
  setTimeout(() => connectStream(contractId, attempt), delay);
}

/**
 * Parses a raw Horizon event record and stores it in the DB.
 * @param {string} contractId
 * @param {object} raw - raw record from Horizon SSE
 */
async function handleRawEvent(contractId, raw) {
  const eventType = extractEventType(raw);
  if (!eventType) return; // skip unknown event types

  const recorded = await recordContractEvent({
    contractId,
    eventType,
    eventData: raw,
    transactionHash: raw.transaction_hash || raw.tx_hash,
    ledgerSequence: raw.ledger || raw.ledger_sequence,
  });

  try {
    await dispatchEvent(contractId, eventType, raw, recorded.id);
    await markEventProcessed(recorded.id);
  } catch (err) {
    await markEventFailed(recorded.id, err.message);
    throw err;
  }
}

/**
 * Dispatches a parsed event to the appropriate handler.
 * Supports both legacy plain types and new namespaced types (e.g. "nova_rwd:staked").
 */
async function dispatchEvent(contractId, eventType, raw, eventId) {
  switch (eventType) {
    // ── Legacy plain types (backward compat) ──────────────────────────────
    case 'mint':
    case 'nova_tok:mint':
      return handleMintEvent(contractId, raw, eventId);
    case 'claim':
      return handleClaimEvent(contractId, raw, eventId);
    case 'stake':
    case 'nova_rwd:staked':
      return handleStakeEvent(contractId, raw, eventId);
    case 'unstake':
    case 'nova_rwd:unstaked':
      return handleUnstakeEvent(contractId, raw, eventId);
    // ── Token events ──────────────────────────────────────────────────────
    case 'nova_tok:burn':
    case 'nova_tok:transfer':
    case 'nova_tok:transfer_from':
    case 'nova_tok:approve':
    case 'nova_tok:inc_allow':
    case 'nova_tok:dec_allow':
      return handleTokenEvent(contractId, eventType, raw, eventId);
    // ── Nova Rewards core events ──────────────────────────────────────────
    case 'nova_rwd:init':
    case 'nova_rwd:bal_set':
    case 'nova_rwd:rate_set':
    case 'nova_rwd:swap':
    case 'nova_rwd:paused':
    case 'nova_rwd:resumed':
    case 'nova_rwd:emrg_paus':
    case 'nova_rwd:rec_op':
    case 'nova_rwd:snap':
    case 'nova_rwd:restore':
    case 'nova_rwd:rec_tx':
    case 'nova_rwd:rec_funds':
    case 'nova_rwd:upgraded':
      return handleNovaRewardsEvent(contractId, eventType, raw, eventId);
    // ── Campaign events ───────────────────────────────────────────────────
    case 'camp:created':
    case 'camp:activated':
    case 'camp:deactivated':
    case 'camp:joined':
    case 'camp:rwd_issued':
    case 'camp:paused':
    case 'camp:unpaused':
    case 'camp:upgraded':
      return handleCampaignEvent(contractId, eventType, raw, eventId);
    // ── Escrow events ─────────────────────────────────────────────────────
    case 'escrow:created':
    case 'escrow:funded':
    case 'escrow:released':
    case 'escrow:refunded':
    case 'escrow:upgraded':
      return handleEscrowEvent(contractId, eventType, raw, eventId);
    // ── Distribution events ───────────────────────────────────────────────
    case 'dist:distributed':
    case 'dist:batch_dist':
    case 'dist:clawback':
    case 'dist:upgraded':
      return handleDistributionEvent(contractId, eventType, raw, eventId);
    // ── Governance events ─────────────────────────────────────────────────
    case 'gov:proposed':
    case 'gov:voted':
    case 'gov:finalised':
    case 'gov:executed':
    case 'gov:upgraded':
      return handleGovernanceEvent(contractId, eventType, raw, eventId);
    // ── Admin roles events ────────────────────────────────────────────────
    case 'adm_roles:adm_prop':
    case 'adm_roles:adm_xfer':
    case 'adm_roles:role_chg':
    case 'adm_roles:upgraded':
      return handleAdminRolesEvent(contractId, eventType, raw, eventId);
    // ── ContractState events ──────────────────────────────────────────────
    case 'state:set':
    case 'state:delete':
    case 'state:snapshot':
    case 'state:migrate':
    case 'state:recover':
    case 'state:upgraded':
      return handleStateEvent(contractId, eventType, raw, eventId);
    default:
      logger.info(`[horizon-stream] No handler for event type: ${eventType}`);
  }
}

/**
 * Extracts the event type from a Horizon record.
 * Soroban contract events carry their topic in the `topic` array as XDR symbols.
 * Returns a namespaced key like "nova_rwd:staked" for structured events,
 * or a plain type string for legacy events.
 */
function extractEventType(record) {
  // Structured Soroban events: topics[0] = contract tag, topics[1] = event name
  if (Array.isArray(record.topic) && record.topic.length >= 2) {
    let tag = null;
    let eventName = null;

    for (let i = 0; i < Math.min(record.topic.length, 2); i++) {
      const topic = record.topic[i];
      let decoded = null;

      try {
        const xdrVal = StellarSdk.xdr.ScVal.fromXDR(topic, 'base64');
        if (xdrVal.switch().name === 'scvSymbol') {
          decoded = xdrVal.sym().toString().toLowerCase();
        }
      } catch {
        // Not XDR — use plain string value
        decoded = (typeof topic === 'object' && topic.value)
          ? String(topic.value).toLowerCase()
          : String(topic).toLowerCase();
      }

      if (i === 0) tag = decoded;
      else eventName = decoded;
    }

    if (tag && eventName) {
      return `${tag}:${eventName}`;
    }
  }

  // Legacy fallback: plain type field
  const plain = (record.type || record.event_type || '').toLowerCase();
  return plain || null;
}

async function handleMintEvent(contractId, event, eventId) {
  logger.info(`[horizon-stream] mint event — contract=${contractId} id=${eventId}`);
}

async function handleClaimEvent(contractId, event, eventId) {
  logger.info(`[horizon-stream] claim event — contract=${contractId} id=${eventId}`);
}

async function handleStakeEvent(contractId, event, eventId) {
  logger.info(`[horizon-stream] stake event — contract=${contractId} id=${eventId}`);
}

async function handleUnstakeEvent(contractId, event, eventId) {
  logger.info(`[horizon-stream] unstake event — contract=${contractId} id=${eventId}`);
}

async function handleTokenEvent(contractId, eventType, event, eventId) {
  logger.info(`[horizon-stream] token event type=${eventType} contract=${contractId} id=${eventId}`);
}

async function handleNovaRewardsEvent(contractId, eventType, event, eventId) {
  logger.info(`[horizon-stream] nova-rewards event type=${eventType} contract=${contractId} id=${eventId}`);
}

async function handleCampaignEvent(contractId, eventType, event, eventId) {
  logger.info(`[horizon-stream] campaign event type=${eventType} contract=${contractId} id=${eventId}`);
}

async function handleEscrowEvent(contractId, eventType, event, eventId) {
  logger.info(`[horizon-stream] escrow event type=${eventType} contract=${contractId} id=${eventId}`);
}

async function handleDistributionEvent(contractId, eventType, event, eventId) {
  logger.info(`[horizon-stream] distribution event type=${eventType} contract=${contractId} id=${eventId}`);
}

async function handleGovernanceEvent(contractId, eventType, event, eventId) {
  logger.info(`[horizon-stream] governance event type=${eventType} contract=${contractId} id=${eventId}`);
}

async function handleAdminRolesEvent(contractId, eventType, event, eventId) {
  logger.info(`[horizon-stream] admin-roles event type=${eventType} contract=${contractId} id=${eventId}`);
}

async function handleStateEvent(contractId, eventType, event, eventId) {
  logger.info(`[horizon-stream] contract-state event type=${eventType} contract=${contractId} id=${eventId}`);
}

/**
 * Retry loop: re-processes failed events up to MAX_RETRIES times.
 */
function startRetryLoop() {
  setInterval(async () => {
    try {
      const pending = await getPendingEvents(MAX_RETRIES);
      for (const ev of pending) {
        try {
          await dispatchEvent(ev.contract_id, ev.event_type, ev.event_data, ev.id);
          await markEventProcessed(ev.id);
        } catch (err) {
          await markEventFailed(ev.id, err.message);
        }
      }
    } catch (err) {
      logger.error('[horizon-stream] Retry loop error:', err.message);
    }
  }, RETRY_LOOP_INTERVAL_MS);
}

/**
 * Gracefully stops all active streams.
 */
function stopEventListener() {
  for (const [contractId, handle] of activeStreams.entries()) {
    try {
      if (typeof handle.close === 'function') handle.close();
    } catch {
      // ignore
    }
    logger.info(`[horizon-stream] Stopped stream for ${contractId}`);
  }
  activeStreams.clear();
}

/**
 * Parses the structured data payload from a Soroban event value array.
 * Returns { schemaVersion, fields } for v1 events, or { fields } for legacy events.
 *
 * @param {Array} value - The decoded event value array
 * @returns {{ schemaVersion: number|null, fields: Array }}
 */
function parseEventData(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return { schemaVersion: null, fields: [] };
  }
  const first = value[0];
  if (typeof first === 'number' && first >= 1) {
    return { schemaVersion: first, fields: value.slice(1) };
  }
  return { schemaVersion: null, fields: value };
}

/**
 * Process a single raw event — exposed for testing.
 */
async function processEvent(contractId, raw) {
  return handleRawEvent(contractId, raw);
}

module.exports = { startEventListener, stopEventListener, extractEventType, parseEventData, processEvent };
