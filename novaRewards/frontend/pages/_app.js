import { WalletProvider } from '../context/WalletContext';
import { AuthProvider } from '../context/AuthContext';
import { TourProvider } from '../context/TourContext';
import { ThemeProvider } from '../context/ThemeContext';
import OnboardingTour from '../components/OnboardingTour';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
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
