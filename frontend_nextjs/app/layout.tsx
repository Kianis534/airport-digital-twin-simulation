import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { SimulationProvider } from '@/context/SimulationContext';
import { site } from '@/lib/site';
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(site.demoUrl),
  title: { default: site.title, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.author, url: site.authorUrl }],
  creator: site.author,
  keywords: [
    'airport digital twin',
    'airport simulation',
    'discrete event simulation',
    'SimPy',
    'passenger flow simulation',
    'queueing simulation',
    'what-if analysis',
    'flight delay prediction',
    'passenger satisfaction prediction',
    'XGBoost',
    'LSTM forecasting',
    'Next.js',
    'FastAPI',
  ],
  openGraph: {
    type: 'website',
    title: site.title,
    description: site.description,
    url: site.demoUrl,
    siteName: site.name,
  },
  twitter: { card: 'summary_large_image', title: site.title, description: site.description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-slate-50 font-sans text-slate-900 antialiased overflow-x-hidden">
        <SimulationProvider>{children}</SimulationProvider>
      </body>
    </html>
  );
}
