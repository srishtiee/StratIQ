import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'StratIQ — AI Executive Decision Platform',
  description: 'Bounded adversarial reasoning for CXO-grade decisions. Customer churn, retention strategy, and risk analysis.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="antialiased text-[#f0f4ff]">{children}</body>
    </html>
  );
}
