import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

/**
 * authStore handles authentication state (user, token, login/logout).
 * Requirements: Auth persistence, DevTools support.
 */
export const useAuthStore = create(
  devtools(
    persist(
      (set) => ({
        user: null,
        token: null,
        isAuthenticated: false,

        /**
         * Sets user and token after successful login.
         * @param {object} user - User object from API.
         * @param {string} token - JWT token.
         */
        login: (user, token) => 
          set({ user, token, isAuthenticated: true }, false, 'auth/login'),

        /**
         * Clears all auth data from state and persistence.
         */
        logout: () => 
          set({ user: null, token: null, isAuthenticated: false }, false, 'auth/logout'),

        /**
         * Updates user profile data.
         * @param {object} userData - New user data.
         */
        updateUser: (userData) => 
          set((state) => ({ user: { ...state.user, ...userData } }), false, 'auth/updateUser'),
      }),
      {
        name: 'nova-auth-storage', // Name of the item in storage (localStorage by default)
        partialize: (state) => ({ 
          user: state.user, 
          token: state.token, 
          isAuthenticated: state.isAuthenticated 
        }),
      }
    ),
    { name: 'AuthStore' }
  )
);
