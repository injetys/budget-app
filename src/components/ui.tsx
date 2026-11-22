export function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className={`mt-0.5 text-[20px] font-semibold tabular ${tone === "pos" ? "text-[#448361]" : tone === "neg" ? "text-[#d44c47]" : ""}`}>{value}</div>
    </div>
  );
}

export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
