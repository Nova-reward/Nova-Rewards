const router = require('express').Router();
const { authenticateUser, requireAdmin } = require('../middleware/authenticateUser');
const { rewardQueue, importQueue } = require('../services/batchQueue');

// All batch routes require admin
router.use(authenticateUser, requireAdmin);

/**
 * POST /api/admin/batch/rewards
 * Enqueue a batch reward distribution job.
 * Body: { items: [{ userId, rewardAmount, rewardType, description?, campaignId? }] }
 */
router.post('/rewards', async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'items must be a non-empty array' });
    }
    const job = await rewardQueue.add('distribute', { items });
    res.status(202).json({ success: true, data: { jobId: job.id, queue: 'batch-reward-distribution', itemCount: items.length } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/batch/import
 * Enqueue a batch user import job.
 * Body: { items: [{ email, password, firstName, lastName }] }
 */
router.post('/import', async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'items must be a non-empty array' });
    }
    const job = await importQueue.add('import', { items });
    res.status(202).json({ success: true, data: { jobId: job.id, queue: 'batch-user-import', itemCount: items.length } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/batch/jobs/:jobId?queue=batch-reward-distribution|batch-user-import
 * Return job status, progress, and result summary.
 */
router.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const queueName = req.query.queue;

    const queue = queueName === 'batch-user-import' ? importQueue : rewardQueue;
    const job = await queue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Job not found' });
    }

    const state    = await job.getState();
    const progress = job.progress;
    const result   = job.returnvalue ?? null;
    const failedReason = job.failedReason ?? null;

    res.json({
      success: true,
      data: {
        jobId:       job.id,
        queue:       queueName || 'batch-reward-distribution',
        state,
        progress,
        attemptsMade: job.attemptsMade,
        result,
        failedReason,
        createdAt:   new Date(job.timestamp).toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
