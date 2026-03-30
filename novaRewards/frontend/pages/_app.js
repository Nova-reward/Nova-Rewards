import { WalletProvider } from '../context/WalletContext';
import { AuthProvider } from '../context/AuthContext';
import { TourProvider } from '../context/TourContext';
import { ThemeProvider } from '../context/ThemeContext';
import OnboardingTour from '../components/OnboardingTour';
import '../styles/globals.css';
import { ThemeProvider } from 'next-themes';

export default function App({ Component, pageProps }) {
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout || ((page) => page);

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
