const { query } = require('../db/index');

/**
 * Finds users who logged in during the previous calendar day (UTC)
 * and have not yet received today's bonus, then credits each with
 * DAILY_BONUS_POINTS as a 'bonus' PointTransaction.
 *
 * Exported separately from the scheduler so it can be unit-tested.
 *
 * @param {Date} [now=new Date()] - injectable for testing
 * @returns {Promise<{ credited: number, failed: number }>}
 */
async function runDailyLoginBonus(now = new Date()) {
  const bonusPoints = Number(process.env.DAILY_BONUS_POINTS) || 10;

  // Midnight UTC today and yesterday
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayUTC = new Date(todayUTC.getTime() - 86_400_000);

  // Users who logged in yesterday and haven't received today's bonus yet
  const { rows: users } = await query(
    `SELECT id FROM users
     WHERE is_deleted = FALSE
       AND last_login_at >= $1
       AND last_login_at <  $2
       AND (daily_bonus_granted_at IS NULL OR daily_bonus_granted_at < $2)`,
    [yesterdayUTC, todayUTC]
  );

  let credited = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await query(
        `INSERT INTO point_transactions (user_id, points, type) VALUES ($1, $2, 'bonus')`,
        [user.id, bonusPoints]
      );
      await query(
        `UPDATE users SET daily_bonus_granted_at = NOW() WHERE id = $1`,
        [user.id]
      );
      credited++;
    } catch (err) {
      console.error(`[dailyLoginBonus] failed for user ${user.id}:`, err.message);
      failed++;
    }
  }

  console.log(`[dailyLoginBonus] credited=${credited} failed=${failed}`);
  return { credited, failed };
}

/**
 * Schedules runDailyLoginBonus to fire at midnight UTC every day.
 * Uses a simple setTimeout loop to avoid adding a cron dependency.
 */
function startDailyLoginBonusJob() {
  function scheduleNext() {
    const now = new Date();
    const nextMidnightUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    const msUntilMidnight = nextMidnightUTC.getTime() - now.getTime();

    setTimeout(async () => {
      await runDailyLoginBonus();
      scheduleNext(); // reschedule for the following midnight
    }, msUntilMidnight);

    console.log(`[dailyLoginBonus] next run in ${Math.round(msUntilMidnight / 1000)}s`);
  }

  scheduleNext();
}

module.exports = { runDailyLoginBonus, startDailyLoginBonusJob };
