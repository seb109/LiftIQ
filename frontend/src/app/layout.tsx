import type { Metadata, Viewport } from 'next';
import { Archivo, Archivo_Narrow, Newsreader } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';

// UI and headings. Variable on the weight axis only: adding the width axis would
// add ~53 KB for a width used nowhere but the counters, which Archivo Narrow covers.
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  display: 'swap',
});

// Rep count, form score and timer. One static weight (~11 KB).
const archivoNarrow = Archivo_Narrow({
  variable: '--font-archivo-narrow',
  subsets: ['latin'],
  weight: '700',
  display: 'swap',
});

// The AI coach's written feedback only. One static weight (~21 KB), not the 56 KB variable file.
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'LiftIQ',
    template: '%s | LiftIQ',
  },
  description:
    'Live form feedback on your lifts from your own camera, with a session log and a written coaching report after every workout.',
};

export const viewport: Viewport = {
  themeColor: '#F1EEE6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${archivoNarrow.variable} ${newsreader.variable}`}>
      <body className="bg-canvas font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
