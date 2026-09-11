import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LiftIQ | Intelligent Training Infrastructure',
  description: 'AI-powered personal fitness coaching through real-time computer vision and post-workout telemetry.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark bg-[#09090B] antialiased`}>
      <body className="min-h-screen bg-[#09090B] text-slate-100 font-sans selection:bg-lime-400/20 selection:text-lime-300">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
