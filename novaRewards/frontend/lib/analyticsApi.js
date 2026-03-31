import api from './api';

// ── Mock data (replace with real API calls when endpoints exist) ──────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function mockGrowth(days) {
  return Array.from({ length: days }, (_, i) => ({
    date: daysAgo(days - 1 - i),
    revenue: Math.round(4000 + Math.random() * 3000 + i * 80),
    users: Math.round(200 + Math.random() * 150 + i * 5),
  }));
}

function mockEngagement(days) {
  const labels = days <= 7
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].slice(0, days)
    : Array.from({ length: Math.ceil(days / 7) }, (_, i) => `W${i + 1}`);
  return labels.map((label) => ({
    label,
    dau: Math.round(180 + Math.random() * 120),
    wau: Math.round(800 + Math.random() * 400),
  }));
}

function mockCampaigns() {
  return [
    { campaign: 'Summer Sale', clicks: 1200, conversions: 340 },
    { campaign: 'Referral Boost', clicks: 890, conversions: 210 },
    { campaign: 'Flash Rewards', clicks: 650, conversions: 180 },
    { campaign: 'Loyalty Tier', clicks: 430, conversions: 95 },
  ];
}

function mockDistribution() {
  return [
    { name: 'Gift Cards', value: 38 },
    { name: 'Cashback', value: 27 },
    { name: 'Points', value: 22 },
    { name: 'Discounts', value: 13 },
  ];
}

function mockSummary(days) {
  return {
    totalRevenue: { value: 128450, change: +5.2 },
    activeUsers: { value: 3842, change: +12.1 },
    conversionRate: { value: 24.6, change: -1.8 },
    rewardsIssued: { value: 9210, change: +8.4 },
  };
}

// ── Fetchers (try real API, fall back to mock) ────────────────────────────────

export async function fetchAnalytics(range) {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  try {
    const [growth, engagement, campaigns, distribution, summary] = await Promise.all([
      api.get('/analytics/growth', { params: { days } }).then(r => r.data),
      api.get('/analytics/engagement', { params: { days } }).then(r => r.data),
      api.get('/analytics/campaigns').then(r => r.data),
      api.get('/analytics/distribution').then(r => r.data),
      api.get('/analytics/summary', { params: { days } }).then(r => r.data),
    ]);
    return { growth, engagement, campaigns, distribution, summary };
  } catch {
    // API not yet implemented — use mock data
    return {
      growth: mockGrowth(days),
      engagement: mockEngagement(days),
      campaigns: mockCampaigns(),
      distribution: mockDistribution(),
      summary: mockSummary(days),
    };
  }
}
