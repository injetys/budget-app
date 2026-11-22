"use client";
import { CATEGORIES } from "@/lib/categories";

export function CategoryPicker({ current, onPick, onClose }: { current: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/20" onClick={onClose}>
      <div className="w-full rounded-t-xl bg-white p-2 pb-[max(env(safe-area-inset-bottom),12px)] shadow-[0_-4px_24px_rgba(15,15,15,0.1)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto my-2 h-1 w-9 rounded-full bg-[#e3e2e0]" />
        <div className="px-3 pb-2 pt-1 text-[12px] font-medium text-ink-3">Move to category</div>
        <div className="max-h-[60vh] overflow-y-auto">
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => onPick(c.id)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[15px] active:bg-hover">
              <span className="w-6 text-center text-[18px]">{c.emoji}</span>
              <span className="flex-1">{c.name}</span>
              {c.id === current && <span className="text-ink-3">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
