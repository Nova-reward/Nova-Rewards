import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * rewardsStore handles rewards, points, and redemptions state.
 * Requirements: Integration with Redux DevTools for debugging.
 */
export const useRewardsStore = create(
  devtools(
    (set) => ({
      points: 0,
      redemptions: [],
      isLoading: false,
      error: null,

      /** Updates user rewards points. */
      setPoints: (points) => set({ points }, false, 'rewards/setPoints'),

      /** Updates list of user redemptions. */
      setRedemptions: (redemptions) => set({ redemptions }, false, 'rewards/setRedemptions'),

      /** Adds a single redemption to the list. */
      addRedemption: (redemption) => 
        set((state) => ({ redemptions: [redemption, ...state.redemptions] }), false, 'rewards/addRedemption'),

      /** Updates loading status for rewards data. */
      setLoading: (isLoading) => set({ isLoading }, false, 'rewards/setLoading'),

      /** Sets an error message for rewards data operations. */
      setError: (error) => set({ error }, false, 'rewards/setError'),
    }),
    { name: 'RewardsStore' }
  )
);
