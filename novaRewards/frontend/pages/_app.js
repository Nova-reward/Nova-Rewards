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
  return (
    <ThemeProvider>
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
