'use strict';

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

  console.log(`[horizon-stream] Connecting to ${url} (attempt ${attempt})`);

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
      console.error(`[horizon-stream] Error handling event for ${contractId}:`, err.message);
    }
  };

  es.onerror = () => {
    console.warn(`[horizon-stream] Stream error for ${contractId}, scheduling reconnect`);
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
          console.error(`[horizon-stream] Error handling record for ${contractId}:`, err.message);
        }
      },
      onerror: (err) => {
        console.warn(`[horizon-stream] SDK stream error for ${contractId}:`, err?.message);
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
  console.log(`[horizon-stream] Reconnecting ${contractId} in ${delay}ms (attempt ${attempt})`);
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
 */
async function dispatchEvent(contractId, eventType, raw, eventId) {
  switch (eventType) {
    case 'mint':
      return handleMintEvent(contractId, raw, eventId);
    case 'claim':
      return handleClaimEvent(contractId, raw, eventId);
    case 'stake':
      return handleStakeEvent(contractId, raw, eventId);
    case 'unstake':
      return handleUnstakeEvent(contractId, raw, eventId);
    default:
      console.log(`[horizon-stream] No handler for event type: ${eventType}`);
  }
}

/**
 * Extracts the event type from a Horizon record.
 * Soroban contract events carry their topic in the `topic` array as XDR symbols.
 */
function extractEventType(record) {
  const valid = ['mint', 'claim', 'stake', 'unstake'];

  // Soroban events: topics[0] is typically the event name as an XDR ScSymbol
  if (Array.isArray(record.topic)) {
    for (const topic of record.topic) {
      try {
        const decoded = StellarSdk.xdr.ScVal.fromXDR(topic, 'base64');
        if (decoded.switch().name === 'scvSymbol') {
          const name = decoded.sym().toString().toLowerCase();
          if (valid.includes(name)) return name;
        }
      } catch {
        // not XDR — try plain string
        if (valid.includes(String(topic).toLowerCase())) return String(topic).toLowerCase();
      }
    }
  }

  // Fallback: plain type field
  const plain = (record.type || record.event_type || '').toLowerCase();
  return valid.includes(plain) ? plain : null;
}

async function handleMintEvent(contractId, event, eventId) {
  console.log(`[horizon-stream] mint event — contract=${contractId} id=${eventId}`);
}

async function handleClaimEvent(contractId, event, eventId) {
  console.log(`[horizon-stream] claim event — contract=${contractId} id=${eventId}`);
}

async function handleStakeEvent(contractId, event, eventId) {
  console.log(`[horizon-stream] stake event — contract=${contractId} id=${eventId}`);
}

async function handleUnstakeEvent(contractId, event, eventId) {
  console.log(`[horizon-stream] unstake event — contract=${contractId} id=${eventId}`);
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
      console.error('[horizon-stream] Retry loop error:', err.message);
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
    console.log(`[horizon-stream] Stopped stream for ${contractId}`);
  }
  activeStreams.clear();
}

module.exports = { startEventListener, stopEventListener };
