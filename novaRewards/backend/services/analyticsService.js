const { query } = require('../db/index');

/**
 * Service to handle analytics tracking and behavior analysis.
 * Requirements: #362 Analytics Service
 */
class AnalyticsService {
  /**
   * Track a generic user event.
   */
  async trackEvent({ userId, name, category, label, value, properties = {} }) {
    try {
      const result = await query(
        `INSERT INTO analytics_events (user_id, name, category, label, value, properties)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId || null, name, category, label || null, value || null, properties]
      );
      return result.rows[0];
    } catch (err) {
      console.error('[Analytics] Failed to track event:', err);
      return null;
    }
  }

  /**
   * Get campaign performance (total value tracked for campaign-related events).
   */
  async getCampaignPerformance(campaignId) {
    const result = await query(
      `SELECT name, COUNT(*) as count, SUM(value) as total_value
       FROM analytics_events
       WHERE properties->>'campaignId' = $1
       GROUP BY name`,
      [String(campaignId)]
    );
    return result.rows;
  }

  /**
   * Simple funnel analysis.
   * Returns conversion counts for sequential steps.
   */
  async getFunnelPerformance(funnelName) {
    // 1. Fetch funnel definition
    const funnelRes = await query('SELECT steps FROM analytics_funnels WHERE name = $1', [funnelName]);
    if (funnelRes.rows.length === 0) return null;

    const steps = funnelRes.rows[0].steps; // [{name: 'step1'}, {name: 'step2'}]
    const counts = [];

    // For simplicity, we'll count unique users per step in the defined order
    // In a real prod environment, this would be a much more complex query ensuring user sequence.
    for (const step of steps) {
      const countRes = await query(
        `SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE name = $1`,
        [step.name]
      );
      counts.push({ step: step.name, count: parseInt(countRes.rows[0].count, 10) });
    }

    return counts;
  }

  /**
   * Cohort analysis (simple retention).
   * Group users by signup month and see how many performed an event in subsequent months.
   */
  async getRetentionCohort(eventName) {
    const queryStr = `
      WITH signup_cohorts AS (
        SELECT id, date_trunc('month', created_at) as signup_month
        FROM users
      )
      SELECT 
        c.signup_month, 
        date_trunc('month', e.created_at) as event_month,
        COUNT(DISTINCT c.id) as active_users
      FROM signup_cohorts c
      JOIN analytics_events e ON c.id = e.user_id
      WHERE e.name = $1
      GROUP BY 1, 2
      ORDER BY 1, 2
    `;
    const result = await query(queryStr, [eventName]);
    return result.rows;
  }
}

module.exports = new AnalyticsService();
