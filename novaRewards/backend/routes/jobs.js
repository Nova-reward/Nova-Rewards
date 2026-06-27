'use strict';

const router = require('express').Router();
const { rewardDistributionQueue } = require('../jobs/queues');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

/**
 * @openapi
 * /jobs/{jobId}:
 *   get:
 *     tags: [Jobs]
 *     summary: Get distribution job status
 *     description: >
 *       Returns the current state and result of a reward distribution job
 *       that was enqueued via POST /api/campaigns/:id/distribute.
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status returned.
 *       404:
 *         description: Job not found.
 */
router.get('/:jobId', authenticateMerchant, async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await rewardDistributionQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Job not found' });
    }

    // Merchants may only query their own distribution jobs
    if (job.data.merchantId !== req.merchant.id) {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'Access denied' });
    }

    const state = await job.getState();
    const returnValue = job.returnvalue;
    const failedReason = job.failedReason;

    return res.json({
      success: true,
      data: {
        jobId: job.id,
        state,
        campaignId: job.data.campaignId,
        recipientCount: job.data.recipients?.length ?? 0,
        ...(returnValue && {
          succeeded: returnValue.succeeded,
          failed: returnValue.failed,
          summary: {
            total: (returnValue.succeeded?.length ?? 0) + (returnValue.failed?.length ?? 0),
            succeeded: returnValue.succeeded?.length ?? 0,
            failed: returnValue.failed?.length ?? 0,
          },
        }),
        ...(failedReason && { failedReason }),
        createdAt: new Date(job.timestamp).toISOString(),
        processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
