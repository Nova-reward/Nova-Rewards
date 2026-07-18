#!/usr/bin/env node
/**
 * Deployment Logger
 *
 * Writes structured JSON deployment logs to deploy/logs/<timestamp>-<network>.json.
 * Each log captures every deployment step with status, timestamps, and metadata.
 *
 * Log file lifecycle:
 *   - Created at deploy start via Logger.begin()
 *   - Steps appended via logger.step()
 *   - Finalized (success or failure) via logger.finish()
 *   - Read back for verification and rollback via Logger.load()
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

/** Ensure the logs directory exists. */
function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * Returns the file path for a deployment log given its ID.
 * @param {string} deploymentId
 * @returns {string}
 */
function logFilePath(deploymentId) {
  return path.join(LOGS_DIR, `${deploymentId}.json`);
}

/**
 * Formats a Date as an ISO-8601 string (UTC).
 * @param {Date} [date]
 * @returns {string}
 */
function iso(date = new Date()) {
  return date.toISOString();
}

/**
 * Deployment step status values.
 */
const Status = Object.freeze({
  PENDING:  'pending',
  SUCCESS:  'success',
  SKIPPED:  'skipped',
  FAILED:   'failed',
  ROLLEDBACK: 'rolled_back',
});

class Logger {
  /**
   * Start a new deployment log.
   *
   * @param {object} options
   * @param {string} options.network   - 'testnet' | 'mainnet'
   * @param {string} options.issuer    - Issuer public key
   * @param {string} options.distribution - Distribution public key
   * @param {string} [options.assetCode]  - Defaults to 'NOVA'
   * @returns {Logger}
   */
  static begin({ network, issuer, distribution, assetCode = 'NOVA' }) {
    ensureLogsDir();

    const startedAt    = new Date();
    const deploymentId = `${iso(startedAt).replace(/[:.]/g, '-').slice(0, 19)}-${network}`;

    const record = {
      deploymentId,
      network,
      assetCode,
      issuer,
      distribution,
      startedAt: iso(startedAt),
      finishedAt: null,
      outcome: 'in_progress',  // 'success' | 'failed' | 'rolled_back'
      steps: [],
    };

    fs.writeFileSync(logFilePath(deploymentId), JSON.stringify(record, null, 2), 'utf8');

    return new Logger(deploymentId, record);
  }

  /**
   * Load an existing deployment log by ID.
   *
   * @param {string} deploymentId
   * @returns {Logger}
   * @throws {Error} if the log file does not exist
   */
  static load(deploymentId) {
    const fp = logFilePath(deploymentId);
    if (!fs.existsSync(fp)) {
      throw new Error(`Deployment log not found: ${fp}`);
    }
    const record = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return new Logger(deploymentId, record);
  }

  /**
   * Load the most recent deployment log for a given network.
   *
   * @param {string} network - 'testnet' | 'mainnet'
   * @returns {Logger}
   * @throws {Error} if no logs exist for the network
   */
  static loadLatest(network) {
    ensureLogsDir();

    const files = fs
      .readdirSync(LOGS_DIR)
      .filter((f) => f.endsWith(`-${network}.json`))
      .sort()
      .reverse();

    if (files.length === 0) {
      throw new Error(`No deployment logs found for network: ${network}`);
    }

    const deploymentId = files[0].replace(/\.json$/, '');
    return Logger.load(deploymentId);
  }

  /**
   * List all deployment log summaries (sorted newest first).
   *
   * @returns {Array<{deploymentId, network, startedAt, outcome}>}
   */
  static listAll() {
    ensureLogsDir();
    return fs
      .readdirSync(LOGS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .map((f) => {
        try {
          const r = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, f), 'utf8'));
          return {
            deploymentId: r.deploymentId,
            network:      r.network,
            startedAt:    r.startedAt,
            finishedAt:   r.finishedAt,
            outcome:      r.outcome,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  constructor(deploymentId, record) {
    this.deploymentId = deploymentId;
    this._record      = record;
  }

  /** Return a shallow copy of the full log record. */
  get record() {
    return { ...this._record };
  }

  /**
   * Append a step to the log.
   *
   * @param {object} options
   * @param {string}  options.name    - Human-readable step name
   * @param {string}  options.status  - One of Status.*
   * @param {object}  [options.data]  - Arbitrary metadata (tx hashes, etc.)
   * @param {string}  [options.error] - Error message if status is FAILED
   * @returns {Logger} (chainable)
   */
  step({ name, status, data = {}, error = null }) {
    const entry = {
      name,
      status,
      timestamp: iso(),
      data,
      ...(error ? { error } : {}),
    };

    this._record.steps.push(entry);
    this._persist();

    const icon = {
      [Status.PENDING]:    '⏳',
      [Status.SUCCESS]:    '✅',
      [Status.SKIPPED]:    '⏭ ',
      [Status.FAILED]:     '❌',
      [Status.ROLLEDBACK]: '↩️ ',
    }[status] ?? '•';

    console.log(`  ${icon}  ${name}${error ? ` — ${error}` : ''}`);

    return this;
  }

  /**
   * Mark an existing step as rolled back.
   * @param {string} stepName
   * @returns {Logger}
   */
  markRolledBack(stepName) {
    const s = this._record.steps.find((s) => s.name === stepName);
    if (s) {
      s.status    = Status.ROLLEDBACK;
      s.rolledAt  = iso();
      this._persist();
    }
    return this;
  }

  /**
   * Finalize the log with the given outcome.
   *
   * @param {'success'|'failed'|'rolled_back'} outcome
   * @param {object} [meta] - Extra data to merge into the root record
   * @returns {Logger}
   */
  finish(outcome, meta = {}) {
    this._record.finishedAt = iso();
    this._record.outcome    = outcome;
    Object.assign(this._record, meta);
    this._persist();
    return this;
  }

  /**
   * Update top-level fields on the record (e.g., txHash from asset issuance).
   * @param {object} fields
   * @returns {Logger}
   */
  update(fields) {
    Object.assign(this._record, fields);
    this._persist();
    return this;
  }

  _persist() {
    fs.writeFileSync(
      logFilePath(this.deploymentId),
      JSON.stringify(this._record, null, 2),
      'utf8'
    );
  }
}

module.exports = { Logger, Status };
