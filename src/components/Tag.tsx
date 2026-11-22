import { categoryById } from "@/lib/categories";

export function CategoryTag({ id, className = "" }: { id: string; className?: string }) {
  const c = categoryById(id);
  return (
    <span className={`tag tag-${c.color} ${className}`}>
      <span className="text-[12px]">{c.emoji}</span>
      {c.name}
    </span>
  );
}

export function PageTitle({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6">
      <div className="mb-2 text-[44px] leading-none">{icon}</div>
      <h1 className="text-[32px] font-bold tracking-tight">{title}</h1>
      {children && <div className="mt-1 text-[15px] text-ink-2">{children}</div>}
    </header>
  );
}
