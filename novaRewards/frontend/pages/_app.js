import { WalletProvider } from '../context/WalletContext';
import { AuthProvider } from '../context/AuthContext';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <WalletProvider>
        <Component {...pageProps} />
      </WalletProvider>
    </AuthProvider>
  );
}
