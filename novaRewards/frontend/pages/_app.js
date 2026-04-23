import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ThemeProvider } from 'next-themes';
import { WalletProvider } from '../context/WalletContext';
import { AuthProvider } from '../context/AuthContext';
import { TourProvider } from '../context/TourContext';
import { ModalProvider } from '../context/ModalContext';
import { ToastProvider } from '../components/Toast';
import { NotificationProvider } from '../context/NotificationContext';
import Footer from '../components/Footer';
import '../styles/globals.css';
import '../styles/redemption.css';

// react-joyride pulls in a large dependency — defer until client
const OnboardingTour = dynamic(() => import('../components/OnboardingTour'), { ssr: false });

function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <WalletProvider>
              <TourProvider>
                <ModalProvider>
                  {/* Skip-to-content — WCAG 2.4.1 */}
                  <a href="#main-content" className="skip-to-content">
                    Skip to main content
                  </a>
                  <main id="main-content">
                    <Component {...pageProps} />
                  </main>
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
