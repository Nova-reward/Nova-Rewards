import { WalletProvider } from '../context/WalletContext';
import { ToastProvider } from '../components/Toast';

export default function App({ Component, pageProps }) {
  return (
    <WalletProvider>
      <ToastProvider>
        <Component {...pageProps} />
      </ToastProvider>
    </WalletProvider>
  );
}