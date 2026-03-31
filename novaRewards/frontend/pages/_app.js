import { useEffect } from 'react';
import { WalletProvider } from '../context/WalletContext';
import { AuthProvider } from '../context/AuthContext';
import { TourProvider } from '../context/TourContext';
import { ThemeProvider } from '../context/ThemeContext';
<<<<<<< feature/modal-dialog-system-332
import { ModalProvider } from '../context/ModalContext';
=======
import { ToastProvider } from '../components/Toast';
import { NotificationProvider } from '../context/NotificationContext';
>>>>>>> main
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
<<<<<<< feature/modal-dialog-system-332
        <WalletProvider>
          <TourProvider>
            <ModalProvider>
              <Component {...pageProps} />
              <OnboardingTour />
            </ModalProvider>
          </TourProvider>
        </WalletProvider>
=======
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
>>>>>>> main
      </AuthProvider>
    </ThemeProvider>
  );
}
