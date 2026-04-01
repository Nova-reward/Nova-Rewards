import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * uiStore controls UI state (modals, loaders, theme, etc.).
 * Requirements: Consistent state across the application.
 */
export const useUIStore = create(
  devtools(
    (set) => ({
      isSidebarOpen: true,
      theme: 'dark', // Default to dark mode
      activeModal: null, // modal name or ID
      isLoading: false,

      /** Toggles the sidebar visibility. */
      toggleSidebar: () => 
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen }), false, 'ui/toggleSidebar'),

      /** Sets the global theme. */
      setTheme: (theme) => set({ theme }, false, 'ui/setTheme'),

      /** Opens a specific modal. */
      openModal: (modalId) => set({ activeModal: modalId }, false, 'ui/openModal'),

      /** Closes the current modal. */
      closeModal: () => set({ activeModal: null }, false, 'ui/closeModal'),

      /** Updates global loading state. */
      setLoading: (isLoading) => set({ isLoading }, false, 'ui/setLoading'),
    }),
    { name: 'UIStore' }
  )
);
