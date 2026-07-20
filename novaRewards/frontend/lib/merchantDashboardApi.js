import api from './api';

// ── Mock data ─────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function mockDailyIssuance(days) {
  return Array.from({ length: days }, (_, i) => ({
    date: daysAgo(days - 1 - i),
    issued: Math.round(200 + Math.random() * 400 + i * 3),
  }));
}

function mockKpis() {
  return {
    totalIssued:    { value: 48320,  change: +8.4 },
    totalRedeemed:  { value: 31205,  change: +5.1 },
    activeUsers:    { value: 1842,   change: +12.3 },
    campaignCount:  { value: 7,      change: 0 },
  };
}

function mockCampaigns() {
  return [
    { id: '1', name: 'Summer Sale',    status: 'active',   rewardRate: 10, startDate: daysAgo(20), endDate: daysAgo(-10) },
    { id: '2', name: 'Referral Boost', status: 'active',   rewardRate: 25, startDate: daysAgo(15), endDate: daysAgo(-5)  },
    { id: '3', name: 'Flash Rewards',  status: 'paused',   rewardRate: 5,  startDate: daysAgo(30), endDate: daysAgo(-1)  },
    { id: '4', name: 'Loyalty Tier',   status: 'inactive', rewardRate: 15, startDate: daysAgo(60), endDate: daysAgo(5)   },
    { id: '5', name: 'New User Promo', status: 'active',   rewardRate: 50, startDate: daysAgo(5),  endDate: daysAgo(-20) },
  ];
}

// ── Fetchers (try real API, fall back to mock) ────────────────────────────────

export async function fetchMerchantKpis(range) {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  try {
    const { data } = await api.get('/merchant/kpis', { params: { days } });
    return data;
  } catch {
    return mockKpis();
  }
}

export async function fetchDailyIssuance(range) {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  try {
    const { data } = await api.get('/merchant/daily-issuance', { params: { days } });
    return data;
  } catch {
    return mockDailyIssuance(days);
  }
}

export async function fetchMerchantCampaigns() {
  try {
    const { data } = await api.get('/merchant/campaigns');
    return data;
  } catch {
    return mockCampaigns();
  }
}

export async function pauseCampaign(id) {
  const { data } = await api.patch(`/merchant/campaigns/${id}/pause`);
  return data;
}

export async function resumeCampaign(id) {
  const { data } = await api.patch(`/merchant/campaigns/${id}/resume`);
  return data;
}
