import '../styles/globals.css';
import { ThemeProvider } from 'next-themes';

export default function App({ Component, pageProps }) {
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout || ((page) => page);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true}>
      {getLayout(<Component {...pageProps} />)}
    </ThemeProvider>
  );
}
