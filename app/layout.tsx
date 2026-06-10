import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/constants/brand';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}
