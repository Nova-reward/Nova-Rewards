/**
 * Contract Events Route
 *
 * Provides indexing, filtering, history, and monitoring for all Soroban
 * contract events emitted by the Nova Rewards ecosystem.
 *
 * Routes:
 *   GET  /api/contract-events            – paginated event history with filters
 *   GET  /api/contract-events/types      – list of known event types
 *   GET  /api/contract-events/monitor    – SSE stream for real-time monitoring
 *   GET  /api/contract-events/:id        – single event by DB id
 *   POST /api/contract-events/index      – manually trigger indexing from a ledger
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const StellarSdk = require('@stellar/stellar-sdk');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const rpc = new StellarSdk.SorobanRpc.Server(
    process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'
);

const EVENT_TYPES = {
    'nova_rwd:init':       { contract: 'nova-rewards', description: 'Contract initialised' },
    'nova_rwd:bal_set':    { contract: 'nova-rewards', description: 'Balance set by admin' },
    'nova_rwd:staked':     { contract: 'nova-rewards', description: 'Tokens staked' },
    'nova_rwd:unstaked':   { contract: 'nova-rewards', description: 'Tokens unstaked with yield' },
    'nova_rwd:rate_set':   { contract: 'nova-rewards', description: 'Annual staking rate updated' },
    'nova_rwd:swap':       { contract: 'nova-rewards', description: 'Nova swapped for XLM' },
    'nova_rwd:paused':     { contract: 'nova-rewards', description: 'Contract paused' },
    'nova_rwd:resumed':    { contract: 'nova-rewards', description: 'Contract resumed' },
    'nova_rwd:emrg_paus': { contract: 'nova-rewards', description: 'Emergency pause set' },
    'nova_rwd:rec_op':     { contract: 'nova-rewards', description: 'Recovery admin assigned' },
    'nova_rwd:snap':       { contract: 'nova-rewards', description: 'Account snapshot taken' },
    'nova_rwd:restore':    { contract: 'nova-rewards', description: 'Account snapshot restored' },
    'nova_rwd:rec_tx':     { contract: 'nova-rewards', description: 'Recovery transaction applied' },
    'nova_rwd:rec_funds':  { contract: 'nova-rewards', description: 'Recovery fund transfer' },
    'nova_rwd:upgraded':   { contract: 'nova-rewards', description: 'Contract WASM upgraded' },
    'nova_tok:mint':       { contract: 'nova_token',   description: 'Tokens minted' },
    'nova_tok:burn':       { contract: 'nova_token',   description: 'Tokens burned' },
    'nova_tok:transfer':   { contract: 'nova_token',   description: 'Token transfer' },
    'nova_tok:approve':    { contract: 'nova_token',   description: 'Allowance approved' },
    'rwd_pool:deposited':  { contract: 'reward_pool',  description: 'Pool deposit' },
    'rwd_pool:withdrawn':  { contract: 'reward_pool',  description: 'Pool withdrawal' },
    'vesting:tok_rel':     { contract: 'vesting',      description: 'Vested tokens released' },
    'referral:ref_reg':    { contract: 'referral',     description: 'Referral registered' },
    'referral:ref_cred':   { contract: 'referral',     description: 'Referrer credited' },
    'gov:proposed':        { contract: 'governance',   description: 'Proposal created' },
    'gov:voted':           { contract: 'governance',   description: 'Vote cast' },
    'gov:finalised':       { contract: 'governance',   description: 'Proposal finalised' },
    'gov:executed':        { contract: 'governance',   description: 'Proposal executed' },
    'dist:distributed':    { contract: 'distribution', description: 'Tokens distributed' },
    'clawback:clawback':   { contract: 'distribution', description: 'Distribution clawed back' },
    'adm_roles:adm_prop':  { contract: 'admin_roles',  description: 'Admin transfer proposed' },
    'adm_roles:adm_xfer':  { contract: 'admin_roles',  description: 'Admin transfer completed' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a WHERE clause and params array from query filters.
 */
function buildFilter(query) {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (query.contract) {
        conditions.push('contract_name = $' + idx++);
        params.push(query.contract);
    }
    if (query.event_type) {
        conditions.push('event_type = $' + idx++);
        params.push(query.event_type);
    }
    if (query.account) {
        const p = '$' + idx;
        conditions.push("(data->>'account' = " + p + " OR data->>'staker' = " + p + " OR data->>'user' = " + p + ')');
        params.push(query.account);
        idx++;
    }
    if (query.ledger_from) {
        conditions.push('ledger_sequence >= $' + idx++);
        params.push(parseInt(query.ledger_from));
    }
    if (query.ledger_to) {
        conditions.push('ledger_sequence <= $' + idx++);
        params.push(parseInt(query.ledger_to));
    }
    if (query.date_from) {
        conditions.push('created_at >= $' + idx++);
        params.push(new Date(query.date_from));
    }
    if (query.date_to) {
        conditions.push('created_at <= $' + idx++);
        params.push(new Date(query.date_to));
    }
    if (query.tx_hash) {
        conditions.push('tx_hash = $' + idx++);
        params.push(query.tx_hash);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    return { where, params, nextIdx: idx };
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/contract-events
 * Paginated, filterable event history.
 */
router.get('/', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);

        const { where, params, nextIdx } = buildFilter(req.query);

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM contract_events ' + where,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        const dataResult = await pool.query(
            'SELECT * FROM contract_events ' + where +
            ' ORDER BY ledger_sequence DESC, id DESC' +
            ' LIMIT $' + nextIdx + ' OFFSET $' + (nextIdx + 1),
            [...params, limit, offset]
        );

        res.json({
            success: true,
            data: dataResult.rows,
            pagination: {
                limit,
                offset,
                total,
                has_more: offset + limit < total,
                next_offset: offset + limit < total ? offset + limit : null,
            },
        });
    } catch (err) {
        console.error('contract-events GET error:', err);
        res.status(500).json({ error: 'Failed to fetch contract events' });
    }
});

/**
 * GET /api/contract-events/types
 * Returns the full event type registry.
 */
router.get('/types', (_req, res) => {
    res.json({ success: true, data: EVENT_TYPES });
});

/**
 * GET /api/contract-events/monitor
 * SSE stream for real-time contract event monitoring.
 */
router.get('/monitor', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const { where, params } = buildFilter(req.query);
    let lastId = 0;

    res.write('event: connected\ndata: {}\n\n');

    const poll = setInterval(async () => {
        try {
            const allParams = [...params, lastId];
            const idPlaceholder = '$' + (params.length + 1);
            const whereClause = where
                ? where + ' AND id > ' + idPlaceholder
                : 'WHERE id > ' + idPlaceholder;

            const result = await pool.query(
                'SELECT * FROM contract_events ' + whereClause + ' ORDER BY id ASC LIMIT 50',
                allParams
            );

            for (const row of result.rows) {
                res.write('event: contract_event\ndata: ' + JSON.stringify(row) + '\n\n');
                lastId = row.id;
            }
        } catch (err) {
            res.write('event: error\ndata: ' + JSON.stringify({ message: err.message }) + '\n\n');
        }
    }, 3000);

    req.on('close', () => {
        clearInterval(poll);
        res.end();
    });
});

/**
 * GET /api/contract-events/:id
 * Fetch a single event by its database id.
 */
router.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    try {
        const result = await pool.query(
            'SELECT * FROM contract_events WHERE id = $1',
            [id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('contract-events/:id error:', err);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

/**
 * POST /api/contract-events/index
 * Manually trigger event indexing from a given start ledger.
 * Body: { contractId: string, startLedger: number }
 */
router.post('/index', async (req, res) => {
    const { contractId, startLedger } = req.body;
    if (!contractId || !startLedger) {
        return res.status(400).json({ error: 'contractId and startLedger are required' });
    }

    try {
        const eventsResponse = await rpc.getEvents({
            startLedger,
            filters: [{ type: 'contract', contractIds: [contractId] }],
            limit: 200,
        });

        const indexed = [];
        for (const event of eventsResponse.events) {
            const topic0 = event.topic[0]?.value ?? '';
            const topic1 = event.topic[1]?.value ?? '';
            const eventType = topic0 + ':' + topic1;
            const contractName = EVENT_TYPES[eventType]?.contract ?? 'unknown';

            const result = await pool.query(
                'INSERT INTO contract_events' +
                ' (contract_id, contract_name, event_type, tx_hash, ledger_sequence, data, created_at)' +
                ' VALUES ($1, $2, $3, $4, $5, $6, NOW())' +
                ' ON CONFLICT (tx_hash, event_type) DO NOTHING' +
                ' RETURNING id',
                [contractId, contractName, eventType, event.txHash, event.ledger, JSON.stringify(event.value)]
            );
            if (result.rows.length) indexed.push(result.rows[0].id);
        }

        res.json({ success: true, indexed: indexed.length, ids: indexed });
    } catch (err) {
        console.error('contract-events/index error:', err);
        res.status(500).json({ error: 'Indexing failed', details: err.message });
    }
});

module.exports = router;
