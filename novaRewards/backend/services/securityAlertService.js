'use strict';

const { sendEmail } = require('./emailService');
const { getConfig } = require('./configService');

const SECURITY_EMAIL = getConfig('SECURITY_ALERT_EMAIL', 'security@novarewards.com');

/**
 * Sends a security alert email for an automatic block event.
 *
 * @param {{ type: string, identifier: string, reason: string, ttlSeconds: number, meta?: object }} alert
 */
async function sendSecurityAlert({ type, identifier, reason, ttlSeconds, meta = {} }) {
  const subject = `[Nova Rewards] Security Alert: ${type}`;
  const html = `
    <h2>Automatic Block Triggered</h2>
    <table>
      <tr><td><strong>Type</strong></td><td>${type}</td></tr>
      <tr><td><strong>Identifier</strong></td><td>${identifier}</td></tr>
      <tr><td><strong>Reason</strong></td><td>${reason}</td></tr>
      <tr><td><strong>Block TTL</strong></td><td>${ttlSeconds}s</td></tr>
      <tr><td><strong>Time</strong></td><td>${new Date().toISOString()}</td></tr>
      ${Object.entries(meta).map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join('')}
    </table>
    <p>Use the admin unblock endpoint to remove this block if it is a false positive.</p>
  `;

  try {
    await sendEmail({ to: SECURITY_EMAIL, subject, html, emailType: 'security_alert' });
  } catch (err) {
    // Alert failure must never crash the request pipeline
    console.error('[securityAlert] Failed to send alert:', err.message);
  }
}

module.exports = { sendSecurityAlert };
