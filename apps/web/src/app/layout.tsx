import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';
import { BrandTitle } from '@/components/shared/brand-title';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Nexus ECM',
  description: 'Phần mềm quản lý nhân sự & chấm công',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body>
        <Providers>
          <BrandTitle />
          {children}
        </Providers>
      </body>
    </html>
  );
}
