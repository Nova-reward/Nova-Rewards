import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

/**
 * authStore handles authentication state (user, token, login/logout).
 * Requirements: Auth persistence, DevTools support.
 *
 * Security boundary: `token` is intentionally excluded from the persisted
 * (localStorage) slice via `partialize` below. JWTs held in localStorage
 * are readable by any script on the page, which makes them a straightforward
 * target for XSS-based theft. `token` therefore lives in memory only and is
 * reset on every full page load/reload. Only non-sensitive fields
 * (`user`, `isAuthenticated`) are persisted so the UI can restore a "logged
 * in" shell on reload; callers needing a token after reload must obtain a
 * fresh one via the refresh-token flow (refresh tokens are HTTP-only
 * cookies, never touched by this store).
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
         * @param {string} token - JWT token. Kept in memory only — see
         *   security boundary note above; never written to localStorage.
         */
        login: (user, token) => 
          set({ user, token, isAuthenticated: true }, false, 'auth/login'),

        /**
         * Clears all auth data from state and persistence atomically.
         * Ensures no stale token residue remains after logout.
         */
        logout: () => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('nova-auth-storage');
          }
          return set({ user: null, token: null, isAuthenticated: false }, false, 'auth/logout');
        },

        /**
         * Updates user profile data.
         * @param {object} userData - New user data.
         */
        updateUser: (userData) => 
          set((state) => ({ user: { ...state.user, ...userData } }), false, 'auth/updateUser'),
      }),
      {
        name: 'nova-auth-storage', // Name of the item in storage (localStorage by default)
        // `token` is deliberately omitted — see security boundary JSDoc above.
        // Only non-sensitive fields are persisted across reloads.
        partialize: (state) => ({ 
          user: state.user, 
          isAuthenticated: state.isAuthenticated 
        }),
      }
    ),
    { name: 'AuthStore' }
  )
);