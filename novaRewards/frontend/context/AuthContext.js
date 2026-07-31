'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import api from '../lib/api';
import { useTokenExpiry } from '../hooks/useTokenExpiry';

const AuthContext = createContext(null);

/**
 * Provides authentication state and actions to the entire app.
 * Requirements: 163.4, 163.5, 163.6
 * Feature: JWT token expiry warning modal (2 min before expiry)
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTokenWarning, setShowTokenWarning] = useState(false);
  const [tokenRefreshLoading, setTokenRefreshLoading] = useState(false);
  const router = useRouter();

  // Track token expiry and manage warning modal
  const { expiresIn, isInactive } = useTokenExpiry(token, {
    warningThreshold: 2,
    inactivityTimeout: 5,
    onWarning: () => {
      setShowTokenWarning(true);
    },
    onExpiry: () => {
      // Auto-logout when token expires
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      setShowTokenWarning(false);
      
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('authUser');
      document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      
      router.push('/login');
    },
  });

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  // Setup Axios interceptor to attach Bearer token
  useEffect(() => {
    const interceptor = api.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, [token]);

  // Setup response interceptor for token expiry
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Attempt silent refresh
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              const response = await api.post('/auth/refresh', { refreshToken });
              const { accessToken } = response.data;
              
              setToken(accessToken);
              localStorage.setItem('authToken', accessToken);
              
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return api(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            logout();
            router.push('/login');
          }
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [router]);

  /**
   * Register a new user
   * Requirements: 162.4, 162.5
   */
  const register = useCallback(async (userData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/register', userData);
      const { accessToken, refreshToken, user: newUser } = response.data;
      
      setToken(accessToken);
      setUser(newUser);
      setIsAuthenticated(true);
      
      localStorage.setItem('authToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('authUser', JSON.stringify(newUser));
      document.cookie = `authToken=${accessToken}; path=/; SameSite=Lax`;
      
      return { success: true, user: newUser };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Login user
   * Requirements: 163.2, 163.3
   */
  const login = useCallback(async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', credentials);
      const { accessToken, refreshToken, user: loggedInUser } = response.data;
      
      setToken(accessToken);
      setUser(loggedInUser);
      setIsAuthenticated(true);
      
      localStorage.setItem('authToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('authUser', JSON.stringify(loggedInUser));
      document.cookie = `authToken=${accessToken}; path=/; SameSite=Lax`;
      
      return { success: true, user: loggedInUser };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh access token silently
   * Used by token expiry warning modal
   */
  const refreshAccessToken = useCallback(async () => {
    setTokenRefreshLoading(true);
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await api.post('/auth/refresh', { refreshToken });
      const { accessToken } = response.data.data;
      
      setToken(accessToken);
      localStorage.setItem('authToken', accessToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      
      setShowTokenWarning(false);
      return { success: true };
    } catch (err) {
      console.error('[refreshAccessToken] Failed to refresh token:', err);
      // If refresh fails, logout user
      logout();
      router.push('/login');
      return { success: false, error: err.message };
    } finally {
      setTokenRefreshLoading(false);
    }
  }, [router]);

  /**
   * Logout user and clear all auth state
   * Requirements: 163.6
   */
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
    setShowTokenWarning(false);
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authUser');
    document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        loading,
        error,
        register,
        login,
        logout,
        clearError,
        // Token expiry management
        showTokenWarning,
        setShowTokenWarning,
        expiresIn,
        isInactive,
        refreshAccessToken,
        tokenRefreshLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to consume auth context.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

/**
 * Higher-order component to protect routes
 * Requirements: 163.7
 */
export function withAuth(WrappedComponent) {
  return function ProtectedRoute(props) {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !isAuthenticated) {
        router.push('/login');
      }
    }, [isAuthenticated, loading, router]);

    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}
