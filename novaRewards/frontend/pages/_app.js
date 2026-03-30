import { useEffect } from 'react';
import { WalletProvider } from '../context/WalletContext';
import { AuthProvider } from '../context/AuthContext';
import { TourProvider } from '../context/TourContext';
import { ThemeProvider } from '../context/ThemeContext';
import OnboardingTour from '../components/OnboardingTour';
import NetworkStatus from '../components/NetworkStatus';
import PWAInstallPrompt from '../components/PWAInstallPrompt';
import { registerServiceWorker } from '../lib/pwa';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <WalletProvider>
          <TourProvider>
            <Component {...pageProps} />
            <OnboardingTour />
          </TourProvider>
        </WalletProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
