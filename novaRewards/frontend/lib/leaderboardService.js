import api from './api';

export const leaderboardService = {
  async getLeaderboard(type = 'all-time') {
    try {
      const response = await api.get(`/leaderboard?type=${type}&limit=50`);
      return response.data;
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  }
};
