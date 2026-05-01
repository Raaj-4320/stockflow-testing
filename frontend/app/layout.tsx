import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';

export const metadata: Metadata = {
  title: 'StockFlow Future Frontend',
  description: 'Future Next.js frontend shell for StockFlow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#f8fafc', color: '#0f172a' }}>
        <header style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
          <strong>StockFlow Future Frontend (Next.js)</strong>
          <nav style={{ marginTop: 8, display: 'flex', gap: 16 }}>
            <Link href="/">Home</Link>
            <Link href="/procurement">Procurement</Link>
          </nav>
        </header>
        <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>{children}</main>
      </body>
    </html>
  );
}
