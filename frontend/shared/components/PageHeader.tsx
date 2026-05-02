export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sf-page-header">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}
