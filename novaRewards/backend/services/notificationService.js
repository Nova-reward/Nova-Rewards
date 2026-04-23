const { createNotification } = require('../db/notificationRepository');
const { sendEmail } = require('./emailService');
const { query } = require('../db/index');

/**
 * NotificationService — dispatches in-app and email notifications.
 * Respects per-user notification_preferences (opt-out per type).
 * Requirements: #582
 */

const EMAIL_TEMPLATES = {
  reward_received: ({ userName, rewardName, pointsEarned }) => ({
    subject: 'NovaRewards — You received a reward!',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center">
          <h1>🎁 Reward Received!</h1>
        </div>
        <div style="background:#f9f9f9;padding:30px">
          <p>Hi ${userName},</p>
          <p>You've received <strong>${rewardName}</strong> worth <strong>${pointsEarned} NOVA</strong>.</p>
          <p>Log in to your dashboard to view your updated balance.</p>
        </div>
        <div style="text-align:center;padding:20px;color:#666;font-size:12px">
          &copy; ${new Date().getFullYear()} NovaRewards. All rights reserved.
        </div>
      </div>`,
  }),

  campaign_expiry: ({ userName, campaignName, expiresAt }) => ({
    subject: 'NovaRewards — Campaign expiring soon',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#f093fb,#f5576c);color:#fff;padding:30px;text-align:center">
          <h1>⏰ Campaign Expiring Soon</h1>
        </div>
        <div style="background:#f9f9f9;padding:30px">
          <p>Hi ${userName},</p>
          <p>The campaign <strong>${campaignName}</strong> expires on <strong>${new Date(expiresAt).toLocaleDateString()}</strong>.</p>
          <p>Don't miss out — redeem your rewards before it ends!</p>
        </div>
        <div style="text-align:center;padding:20px;color:#666;font-size:12px">
          &copy; ${new Date().getFullYear()} NovaRewards. All rights reserved.
        </div>
      </div>`,
  }),

  redemption_confirmed: ({ userName, rewardName, pointsSpent, redemptionId }) => ({
    subject: 'NovaRewards — Redemption Confirmed',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center">
          <h1>✅ Redemption Confirmed</h1>
        </div>
        <div style="background:#f9f9f9;padding:30px">
          <p>Hi ${userName},</p>
          <p>Your redemption of <strong>${rewardName}</strong> (${pointsSpent} points) has been confirmed.</p>
          <p><strong>Redemption ID:</strong> #${redemptionId}</p>
        </div>
        <div style="text-align:center;padding:20px;color:#666;font-size:12px">
          &copy; ${new Date().getFullYear()} NovaRewards. All rights reserved.
        </div>
      </div>`,
  }),
};

// Map notification type → preference key
const PREF_KEY = {
  reward_received:      'rewards',
  campaign_expiry:      'campaigns',
  redemption_confirmed: 'redemptions',
};

/**
 * Send an in-app notification and optionally an email.
 *
 * @param {number} userId
 * @param {'reward_received'|'campaign_expiry'|'redemption_confirmed'} type
 * @param {object} payload  - Template variables + optional { title, message } overrides
 */
async function send(userId, type, payload) {
  // ── 1. Fetch user preferences and email ──────────────────────────────────
  const { rows } = await query(
    'SELECT email, first_name, notification_preferences FROM users WHERE id = $1 AND is_deleted = FALSE',
    [userId]
  );
  const user = rows[0];
  if (!user) return;

  const prefs = user.notification_preferences ?? {};
  const prefKey = PREF_KEY[type];

  // ── 2. Store in-app notification ─────────────────────────────────────────
  const title   = payload.title   ?? type.replace(/_/g, ' ');
  const message = payload.message ?? JSON.stringify(payload);

  await createNotification({ userId, type, title, message, payload });

  // ── 3. Send email if opted-in (default true for unknown types) ────────────
  const emailOptedIn = prefKey === undefined ? true : prefs[prefKey] !== false;
  if (!emailOptedIn || !user.email) return;

  const template = EMAIL_TEMPLATES[type];
  if (!template) return;

  const userName = user.first_name || user.email;
  const { subject, html } = template({ userName, ...payload });

  await sendEmail({ to: user.email, subject, html, emailType: type }).catch((err) => {
    console.error(`[NotificationService] email failed for user ${userId}:`, err.message);
  });
}

module.exports = { send };
