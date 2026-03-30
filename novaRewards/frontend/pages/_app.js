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
  return (
    <ThemeProvider>
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
