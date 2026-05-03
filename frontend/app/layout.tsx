import type { Metadata } from 'next';
import React from 'react';

import { AppShell } from '@/shared/components/AppShell';
import './styles/globals.css';

export const metadata: Metadata = {
  title: 'StockFlow Future Frontend',
  description: 'Future Next.js frontend shell for StockFlow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
