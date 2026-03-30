'use client';

import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';
import { useTour } from '../context/TourContext';
import { usePWA } from '../hooks/usePWA';
import axios from 'axios';

/**
 * Settings page - user account settings
 * Requirements: 164.2
 */
function SettingsContent() {
  const { startTour } = useTour();
  const { 
    isOnline, 
    notificationPermission, 
    enableNotifications, 
    disableNotifications 
  } = usePWA();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleEnableNotifications = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const subscription = await enableNotifications();
      
      if (subscription) {
        // Send subscription to backend
        const userId = localStorage.getItem('userId') || 'anonymous';
        await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/subscribe`, {
          subscription,
          userId,
        });
        
        setMessage('Notifications enabled successfully!');
      } else {
        setMessage('Failed to enable notifications. Please check permissions.');
      }
    } catch (error) {
      console.error('Enable notifications error:', error);
      setMessage('Error enabling notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      await disableNotifications();
      const userId = localStorage.getItem('userId') || 'anonymous';
      
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/unsubscribe`, {
        userId,
      });
      
      setMessage('Notifications disabled');
    } catch (error) {
      console.error('Disable notifications error:', error);
      setMessage('Error disabling notifications');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>⚙️ Settings</h2>
          <p style={{ color: 'var(--muted)' }}>
            Manage your account and app settings.
          </p>
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>📱 App Settings</h3>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Connection Status: {isOnline ? '🟢 Online' : '🔴 Offline'}
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
              Push Notifications
            </h4>
            <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Get notified about rewards, campaigns, and important updates.
            </p>
            
            {notificationPermission === 'granted' ? (
              <button
                className="btn btn-secondary"
                onClick={handleDisableNotifications}
                disabled={loading}
              >
                {loading ? 'Processing...' : '🔕 Disable Notifications'}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleEnableNotifications}
                disabled={loading || notificationPermission === 'denied'}
              >
                {loading ? 'Processing...' : '🔔 Enable Notifications'}
              </button>
            )}
            
            {notificationPermission === 'denied' && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Notifications blocked. Please enable them in your browser settings.
              </p>
            )}
            
            {message && (
              <p style={{ 
                color: message.includes('Error') ? '#ef4444' : '#10b981', 
                fontSize: '0.875rem', 
                marginTop: '0.5rem' 
              }}>
                {message}
              </p>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Platform Tour</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9375rem' }}>
            Replay the onboarding walkthrough to revisit key platform features.
          </p>
          <button
            className="btn btn-secondary"
            onClick={startTour}
            aria-label="Restart platform onboarding tour"
          >
            🗺️ Restart Tour
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Settings() {
  return (
    <ErrorBoundary>
      <SettingsContent />
    </ErrorBoundary>
  );
}

export default withAuth(Settings);
