import { WalletProvider } from '../context/WalletContext';
import { AuthProvider } from '../context/AuthContext';
import { TourProvider } from '../context/TourContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ModalProvider } from '../context/ModalContext';
import OnboardingTour from '../components/OnboardingTour';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WalletProvider>
          <TourProvider>
            <ModalProvider>
              <Component {...pageProps} />
              <OnboardingTour />
            </ModalProvider>
          </TourProvider>
        </WalletProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
