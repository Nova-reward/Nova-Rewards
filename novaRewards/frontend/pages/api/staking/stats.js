/**
 * API endpoint for staking statistics
 * GET /api/staking/stats
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // In a real implementation, this would query the database or contract
    // For now, returning mock data with realistic values
    
    const stats = {
      apy: 12.5, // 12.5% annual percentage yield
      tvl: 2500000, // Total value locked: 2.5M NOVA
      totalStakers: 342, // Number of active stakers
      totalRewardsDistributed: 125000, // Total rewards distributed
      averageStakeAmount: 7309.94, // Average stake per user
      lastUpdated: new Date().toISOString(),
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Staking stats API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch staking statistics',
      message: error.message 
    });
  }
}
