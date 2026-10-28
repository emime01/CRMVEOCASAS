import { Instrument_Sans } from 'next/font/google';
import './globals.css';

const fuente = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' });

export const metadata = { title: 'Prospección de inmobiliarias | Veocasas' };

export default function Layout({ children }) {
  return <html lang="es"><body className={fuente.className}>{children}</body></html>;
}
