"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

const TABS = [
  { href: "/", label: "Review", icon: "📥" },
  { href: "/month", label: "Month", icon: "🗓️" },
  { href: "/year", label: "Year", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function TabBar() {
  const path = usePathname();
  const { txns } = useStore();
  const pending = txns.filter((t) => !t.reviewed).length;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/90 backdrop-blur safe-bottom">
      <div className="mx-auto flex max-w-[720px]">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${active ? "text-ink" : "text-ink-3"}`}>
              <span className={`text-[20px] ${active ? "" : "opacity-60 grayscale"}`}>{t.icon}</span>
              <span className={active ? "font-medium" : ""}>{t.label}</span>
              {t.href === "/" && pending > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 rounded-full bg-[#eb5757] px-1.5 text-[10px] leading-4 text-white tabular">{pending}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
