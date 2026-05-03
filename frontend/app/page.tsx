import { PageHeader } from '@/shared/components/PageHeader';

export default function HomePage() {
  return (
    <section>
      <PageHeader title="Future StockFlow Frontend Shell" subtitle="Phase 2 shell-only layout and navigation skeleton." />
      <div className="sf-card">Legacy root Vite app remains active. No cutover is performed in this phase.</div>
    </section>
  );
}
