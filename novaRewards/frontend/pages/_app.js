import { useEffect } from 'react';
import { WalletProvider } from '../context/WalletContext';
import { AuthProvider } from '../context/AuthContext';
import { TourProvider } from '../context/TourContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../components/Toast';
import { NotificationProvider } from '../context/NotificationContext';
import OnboardingTour from '../components/OnboardingTour';
import Footer from '../components/Footer';
import '../styles/globals.css';
import '../styles/redemption.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <ThemeProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </Head>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <WalletProvider>
              <TourProvider>
                <Component {...pageProps} />
                <Footer />
                <OnboardingTour />
              </TourProvider>
            </WalletProvider>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
