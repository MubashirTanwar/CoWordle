import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'CoWordle — Multiplayer Wordle',
  description: 'Play Wordle with friends in real-time',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#121213] text-white min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
