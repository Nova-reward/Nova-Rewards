import { WalletProvider } from '../context/WalletContext';
import { AuthProvider } from '../context/AuthContext';
import { TourProvider } from '../context/TourContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../components/Toast';
import OnboardingTour from '../components/OnboardingTour';
import '../styles/globals.css';
import '../styles/redemption.css';

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WalletProvider>
          <TourProvider>
            <ToastProvider>
              <Component {...pageProps} />
              <OnboardingTour />
            </ToastProvider>
          </TourProvider>
        </WalletProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
