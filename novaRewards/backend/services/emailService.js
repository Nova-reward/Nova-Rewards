const nodemailer = require('nodemailer');
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASSWORD,
  EMAIL_FROM,
  SENDGRID_API_KEY,
} = require('./configService');
const {
  createEmailLog,
  markEmailSent,
  markEmailDelivered,
  markEmailFailed,
} = require('../db/emailLogRepository');

/**
 * Email service for sending transactional emails.
 * Requirements: #184
 */

// Create SMTP transporter for local development
const smtpTransporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER && SMTP_PASSWORD ? {
    user: SMTP_USER,
    pass: SMTP_PASSWORD,
  } : undefined,
});

/**
 * Sends an email using the appropriate transport (SendGrid or SMTP).
 * @param {object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} options.emailType - Email type for logging
 * @returns {Promise<{success: boolean, logId?: number, error?: string}>}
 */
async function sendEmail({ to, subject, html, emailType }) {
  let logId;

  try {
    // Create email log entry
    const log = await createEmailLog({
      recipientEmail: to,
      emailType,
      subject,
    });
    logId = log.id;

    // Use SendGrid if API key is available, otherwise use SMTP
    if (SENDGRID_API_KEY) {
      // SendGrid API implementation
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: EMAIL_FROM },
          subject,
          content: [{ type: 'text/html', value: html }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid API error: ${error}`);
      }

      await markEmailSent(logId);
      return { success: true, logId };
    } else {
      // SMTP transport
      await smtpTransporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        html,
      });

      await markEmailSent(logId);
      return { success: true, logId };
    }
  } catch (error) {
    console.error('Error sending email:', error);
    if (logId) {
      await markEmailFailed(logId, error.message);
    }
    return { success: false, logId, error: error.message };
  }
}

/**
 * Sends a redemption confirmation email.
 * Requirements: #184
 *
 * @param {object} params
 * @param {string} params.to           - Recipient email
 * @param {string} params.userName     - User's display name or wallet address
 * @param {string} params.rewardName   - Name of the redeemed reward
 * @param {number} params.pointsSpent  - Points deducted
 * @param {number} params.redemptionId - Redemption record ID
 * @returns {Promise<{success: boolean, logId?: number, error?: string}>}
 */
async function sendRedemptionConfirmation({ to, userName, rewardName, pointsSpent, redemptionId }) {
  const subject = 'NovaRewards - Redemption Confirmation';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Redemption Confirmed!</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>Your redemption has been successfully processed.</p>
          <p><strong>Reward:</strong> ${rewardName}</p>
          <p><strong>Points spent:</strong> ${pointsSpent}</p>
          <p><strong>Redemption ID:</strong> #${redemptionId}</p>
          <p>Thank you for being a valued NovaRewards member!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} NovaRewards. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html, emailType: 'redemption_confirmation' });
}

/**
 * Sends a milestone achieved email.
 * Requirements: #184
 *
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.userName - User's name
 * @param {string} params.milestoneName - Milestone name
 * @param {string|number} params.rewardAmount - Reward amount
 * @returns {Promise<{success: boolean, logId?: number, error?: string}>}
 */
async function sendMilestoneAchieved({ to, userName, milestoneName, rewardAmount }) {
  const subject = 'NovaRewards - Milestone Achieved!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .milestone { background: #fff; border-left: 4px solid #f5576c; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Congratulations!</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>You've achieved a new milestone!</p>
          <div class="milestone">
            <h3>${milestoneName}</h3>
            <p><strong>Reward:</strong> ${rewardAmount} NOVA</p>
          </div>
          <p>Keep up the great work and continue earning rewards!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} NovaRewards. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html, emailType: 'milestone_achieved' });
}

/**
 * Sends a welcome email.
 * Requirements: #184
 *
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.userName - User's name
 * @param {string} [params.referralCode] - Optional referral code
 * @returns {Promise<{success: boolean, logId?: number, error?: string}>}
 */
async function sendWelcome({ to, userName, referralCode }) {
  const subject = 'Welcome to NovaRewards!';
  const referralSection = referralCode ? `
    <div class="referral">
      <h3>Share & Earn</h3>
      <p>Share your referral code with friends and earn bonus points:</p>
      <p><strong>${referralCode}</strong></p>
    </div>
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .referral { background: #fff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to NovaRewards!</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>Welcome to NovaRewards! We're excited to have you on board.</p>
          <p>Start earning rewards by completing tasks, referring friends, and participating in campaigns.</p>
          ${referralSection}
          <p>Get started by exploring your dashboard and discovering all the ways to earn NOVA tokens!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} NovaRewards. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html, emailType: 'welcome' });
}

/**
 * Sends a password reset email.
 * Requirements: #184
 *
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.userName - User's name
 * @param {string} params.resetLink - Password reset link
 * @returns {Promise<{success: boolean, logId?: number, error?: string}>}
 */
async function sendPasswordReset({ to, userName, resetLink }) {
  const subject = 'NovaRewards - Password Reset Request';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </p>
          <div class="warning">
            <p><strong>Note:</strong> This link will expire in 24 hours. If you didn't request a password reset, please ignore this email.</p>
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} NovaRewards. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html, emailType: 'password_reset' });
}

module.exports = {
  sendEmail,
  sendRedemptionConfirmation,
  sendMilestoneAchieved,
  sendWelcome,
  sendPasswordReset,
};
