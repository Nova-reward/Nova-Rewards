import { WalletProvider } from '../context/WalletContext';
import { AuthProvider } from '../context/AuthContext';
import { TourProvider } from '../context/TourContext';
import OnboardingTour from '../components/OnboardingTour';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <WalletProvider>
        <TourProvider>
          <Component {...pageProps} />
          <OnboardingTour />
        </TourProvider>
      </WalletProvider>
    </AuthProvider>
  );
}
