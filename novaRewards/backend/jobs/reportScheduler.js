const { getReport } = require('../services/reportingService');

const VALID_INTERVALS = ['daily', 'weekly', 'monthly'];
const VALID_TYPES = ['user', 'campaign', 'transaction', 'revenue'];

// In-memory schedule store (replace with DB persistence if needed)
const schedules = new Map();

/**
 * Returns ms until the next interval boundary from `now`.
 * @param {'daily'|'weekly'|'monthly'} interval
 * @param {Date} now
 * @returns {number}
 */
function msUntilNext(interval, now = new Date()) {
  const n = new Date(now);
  if (interval === 'daily') {
    const next = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
    return next.getTime() - now.getTime();
  }
  if (interval === 'weekly') {
    const daysUntilMonday = (8 - n.getUTCDay()) % 7 || 7;
    const next = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + daysUntilMonday));
    return next.getTime() - now.getTime();
  }
  // monthly — first of next month
  const next = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1));
  return next.getTime() - now.getTime();
}

/**
 * Schedules a recurring report generation.
 * @param {string} id        - Unique schedule ID
 * @param {string} type      - Report type
 * @param {string} interval  - 'daily' | 'weekly' | 'monthly'
 * @param {object} params    - Report params (filters)
 * @returns {{ id: string, type: string, interval: string, params: object }}
 */
function scheduleReport(id, type, interval, params = {}) {
  if (!VALID_TYPES.includes(type)) throw Object.assign(new Error(`Invalid report type: ${type}`), { status: 400 });
  if (!VALID_INTERVALS.includes(interval)) throw Object.assign(new Error(`Invalid interval: ${interval}`), { status: 400 });

  // Cancel existing schedule with same id
  if (schedules.has(id)) clearTimeout(schedules.get(id).timer);

  function run() {
    getReport(type, params)
      .then(() => console.log(`[reporting] scheduled report id=${id} type=${type} completed`))
      .catch((err) => console.error(`[reporting] scheduled report id=${id} failed:`, err.message));

    const timer = setTimeout(run, msUntilNext(interval));
    schedules.set(id, { id, type, interval, params, timer });
  }

  const timer = setTimeout(run, msUntilNext(interval));
  schedules.set(id, { id, type, interval, params, timer });

  console.log(`[reporting] scheduled id=${id} type=${type} interval=${interval}`);
  return { id, type, interval, params };
}

/**
 * Returns all active schedules (without timer handles).
 * @returns {object[]}
 */
function listSchedules() {
  return [...schedules.values()].map(({ id, type, interval, params }) => ({ id, type, interval, params }));
}

/**
 * Cancels a scheduled report.
 * @param {string} id
 * @returns {boolean}
 */
function cancelSchedule(id) {
  const s = schedules.get(id);
  if (!s) return false;
  clearTimeout(s.timer);
  schedules.delete(id);
  return true;
}

module.exports = { scheduleReport, listSchedules, cancelSchedule, msUntilNext, VALID_TYPES, VALID_INTERVALS };
