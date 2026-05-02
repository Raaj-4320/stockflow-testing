import Link from 'next/link';
import React from 'react';

type NavItem = { href: string; label: string };
const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/procurement', label: 'Procurement' },
  { href: '/finance', label: 'Finance' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/inventory', label: 'Inventory' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sf-shell">
      <aside className="sf-sidebar">
        <h1 className="sf-logo">StockFlow Next Shell</h1>
        <nav className="sf-nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="sf-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="sf-content">{children}</section>
    </div>
  );
}
