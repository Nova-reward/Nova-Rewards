import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * campaignStore handles campaigns and related data.
 * Requirements: Modular state management.
 */
export const useCampaignStore = create(
  devtools(
    (set) => ({
      campaigns: [],
      selectedCampaign: null,
      isLoading: false,

      /** Fetches campaigns and updates list. */
      setCampaigns: (campaigns) => set({ campaigns }, false, 'campaigns/setCampaigns'),

      /** Sets the currently selected campaign. */
      selectCampaign: (selectedCampaign) => 
        set({ selectedCampaign }, false, 'campaigns/selectCampaign'),

      /** Updates campaign loading status. */
      setLoading: (isLoading) => set({ isLoading }, false, 'campaigns/setLoading'),

      /** Adds a new campaign to the list. */
      addCampaign: (campaign) => 
        set((state) => ({ campaigns: [campaign, ...state.campaigns] }), false, 'campaigns/addCampaign'),

      /** Removes a campaign from the list by ID. */
      removeCampaign: (id) => 
        set(
          (state) => ({ campaigns: state.campaigns.filter((c) => c.id !== id) }),
          false,
          'campaigns/removeCampaign'
        ),
    }),
    { name: 'CampaignStore' }
  )
);
