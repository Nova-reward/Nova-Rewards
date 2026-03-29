import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import api from '../lib/api';
import confetti from 'canvas-confetti';

/**
 * StellarDropModal - Displays eligible drops and handles claiming
 * Features: Eligibility polling, confetti animation, claim functionality, accessibility
 */
const StellarDropModal = forwardRef(({ onClaimSuccess, onModalClose }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [drop, setDrop] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState(null);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    checkEligibility
  }));

  // Check for eligible drops
  const checkEligibility = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/drops/eligible');
      
      if (response.data.success && response.data.data && response.data.data.length > 0) {
        // Take the first eligible drop
        const eligibleDrop = response.data.data[0];
        setDrop(eligibleDrop);
        setIsOpen(true);
        triggerConfetti();
      }
    } catch (err) {
      // Silently suppress errors as per requirements
      console.log('No eligible drops found or error checking eligibility');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger confetti animation
  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Shoot confetti from random positions
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  // Claim the drop
  const handleClaim = async () => {
    if (!drop || isClaiming) return;

    try {
      setIsClaiming(true);
      setError(null);
      
      const response = await api.post(`/api/drops/${drop.id}/claim`, {
        proof: drop.proof || []
      });

      if (response.data.success) {
        setClaimedAmount(response.data.data.amount || drop.tokenAmount);
        setSuccess(true);
        
        // Update points widget
        if (onClaimSuccess) {
          onClaimSuccess(response.data.data.amount || drop.tokenAmount);
        }

        // Auto-dismiss after success
        setTimeout(() => {
          handleClose();
        }, 3000);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to claim drop. Please try again.';
      setError(errorMessage);
    } finally {
      setIsClaiming(false);
    }
  };

  // Close modal
  const handleClose = () => {
    if (isClaiming) return; // Prevent closing while claiming
    
    setIsOpen(false);
    setDrop(null);
    setError(null);
    setSuccess(false);
    setClaimedAmount(null);
    
    // Return focus to previous element
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
    
    if (onModalClose) {
      onModalClose();
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isClaiming) {
      handleClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !isClaiming) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Store current focus and move to modal
      previousFocusRef.current = document.activeElement;
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isClaiming]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements?.[0];
    const lastElement = focusableElements?.[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div 
        ref={modalRef}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drop-modal-title"
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '480px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          position: 'relative',
          outline: 'none'
        }}
      >
        {/* Close button */}
        {!isClaiming && (
          <button
            onClick={handleClose}
            aria-label="Close modal"
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.25rem'
            }}
          >
            ×
          </button>
        )}

        {/* Success State */}
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 
              id="drop-modal-title"
              style={{ 
                color: '#10b981', 
                marginBottom: '1rem',
                fontSize: '1.5rem'
              }}
            >
              Successfully Claimed!
            </h2>
            <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              You received <strong>{claimedAmount} NOVA</strong> tokens
            </p>
            <p style={{ color: '#6b7280' }}>
              The tokens have been added to your balance
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⭐</div>
              <h2 
                id="drop-modal-title"
                style={{ 
                  color: '#7c3aed', 
                  marginBottom: '0.5rem',
                  fontSize: '1.5rem'
                }}
              >
                Stellar Drop Available!
              </h2>
              <p style={{ color: '#6b7280' }}>
                You've qualified for a special reward
              </p>
            </div>

            {/* Drop Details */}
            <div style={{ 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px', 
              padding: '1.5rem', 
              marginBottom: '1.5rem' 
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  Token Amount
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#7c3aed' }}>
                  {drop?.tokenAmount} NOVA
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  Expires
                </div>
                <div style={{ fontSize: '1rem', color: '#111827' }}>
                  {drop?.expiryDate ? formatDate(drop.expiryDate) : 'Never'}
                </div>
              </div>

              <div>
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  Eligibility Reason
                </div>
                <div style={{ fontSize: '1rem', color: '#111827' }}>
                  {drop?.eligibilityReason || 'Special promotion'}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '0.75rem',
                marginBottom: '1rem',
                color: '#dc2626',
                fontSize: '0.875rem'
              }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {!isClaiming && (
                <button
                  onClick={handleClose}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    backgroundColor: 'white',
                    color: '#6b7280',
                    cursor: 'pointer'
                  }}
                >
                  Maybe Later
                </button>
              )}
              
              <button
                onClick={handleClaim}
                disabled={isClaiming}
                aria-busy={isClaiming}
                className="btn btn-primary"
                style={{
                  padding: '0.75rem 2rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  cursor: isClaiming ? 'not-allowed' : 'pointer',
                  opacity: isClaiming ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                {isClaiming ? (
                  <>
                    <div 
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #ffffff',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}
                    />
                    Claiming...
                  </>
                ) : (
                  'Claim Drop'
                )}
              </button>
            </div>
          </>
        )}

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
});

StellarDropModal.displayName = 'StellarDropModal';

export default StellarDropModal;

// Export a hook for easy integration
export function useStellarDrop() {
  const [dropModalProps, setDropModalProps] = useState({
    isOpen: false,
    onClaimSuccess: null,
    onModalClose: null
  });

  const showDropModal = useCallback((callbacks = {}) => {
    setDropModalProps(prev => ({ ...prev, ...callbacks }));
  }, []);

  return { showDropModal, dropModalProps };
}
