import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { WalletProvider } from '../context/WalletContext';
import { AuthProvider } from '../context/AuthContext';
import { TourProvider } from '../context/TourContext';
import { ModalProvider } from '../context/ModalContext';
import { ToastProvider } from '../components/Toast';
import { NotificationProvider } from '../context/NotificationContext';
import OnboardingTour from '../components/OnboardingTour';
import Footer from '../components/Footer';
import '../styles/globals.css';
import '../styles/redemption.css';

function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <WalletProvider>
              <TourProvider>
                <ModalProvider>
                  <Component {...pageProps} />
                  <Footer />
                  <OnboardingTour />
                </ModalProvider>
              </TourProvider>
            </WalletProvider>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
