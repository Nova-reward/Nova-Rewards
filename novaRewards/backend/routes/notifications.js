const express = require('express');
const router = express.Router();

// In-memory storage for subscriptions (use database in production)
const subscriptions = new Map();

// Subscribe to push notifications
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, userId } = req.body;

    if (!subscription || !userId) {
      return res.status(400).json({ error: 'Subscription and userId required' });
    }

    subscriptions.set(userId, subscription);

    res.status(201).json({ 
      success: true, 
      message: 'Subscription saved successfully' 
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    subscriptions.delete(userId);

    res.json({ 
      success: true, 
      message: 'Unsubscribed successfully' 
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// Send push notification (admin only)
router.post('/send', async (req, res) => {
  try {
    const { userId, title, body, url } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const subscription = subscriptions.get(userId);

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found for user' });
    }

    const webpush = require('web-push');
    
    // Configure VAPID keys (set these in environment variables)
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        'mailto:' + (process.env.VAPID_EMAIL || 'admin@novarewards.com'),
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );

      const payload = JSON.stringify({ title, body, url });
      await webpush.sendNotification(subscription, payload);

      res.json({ 
        success: true, 
        message: 'Notification sent successfully' 
      });
    } else {
      res.status(500).json({ error: 'VAPID keys not configured' });
    }
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

module.exports = router;
