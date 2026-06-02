import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider } from 'next-themes';
import { WalletProvider } from '../context/WalletContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { TourProvider } from '../context/TourContext';
import { ModalProvider } from '../context/ModalContext';
import { ToastProvider } from '../components/Toast';
import { NotificationProvider } from '../context/NotificationContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Footer from '../components/Footer';
import OnboardingModal from '../components/OnboardingModal';
import { useOnboardingStore } from '../store/onboardingStore';
import '../styles/globals.css';
import '../styles/redemption.css';
import '../styles/landing.css';

// react-joyride pulls in a large dependency — defer until client
const OnboardingTour = dynamic(() => import('../components/OnboardingTour'), { ssr: false });

function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

/** Opens the onboarding modal for newly authenticated users. */
function OnboardingTrigger() {
  const { isAuthenticated } = useAuth();
  const { open, isCompleted, isDismissed } = useOnboardingStore();

  useEffect(() => {
    if (isAuthenticated && !isCompleted && !isDismissed) {
      open();
    }
  }, [isAuthenticated, isCompleted, isDismissed, open]);

  return null;
}

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
};

const pageTransition = { duration: 0.15, ease: 'easeOut' };

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <ToastProvider>
            <NotificationProvider>
              <WalletProvider>
                <TourProvider>
                  <ModalProvider>
                    <OnboardingTrigger />
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={router.asPath}
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                        style={{ isolation: 'isolate' }}
                      >
                        <Component {...pageProps} />
                      </motion.div>
                    </AnimatePresence>
                    <Footer />
                    <OnboardingModal />
                    <OnboardingTour />
                  </ModalProvider>
                </TourProvider>
              </WalletProvider>
            </NotificationProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
