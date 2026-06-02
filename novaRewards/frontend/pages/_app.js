import Head from "next/head";
import { WalletProvider } from "../context/WalletContext";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <WalletProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </WalletProvider>
  );
}
