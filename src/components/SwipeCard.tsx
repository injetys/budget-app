"use client";
import { useRef, useState } from "react";
import type { Account, Transaction } from "@/lib/types";
import { CategoryTag } from "./Tag";
import { money2 } from "@/lib/engine";

const THRESHOLD = 100;

/** Drag right = accept, drag left = change category. Pointer events work for touch + mouse. */
export function SwipeCard({ txn, account, onAccept, onReject, depth = 0 }: {
  txn: Transaction; account?: Account; onAccept: () => void; onReject: () => void; depth?: number;
}) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);

  const finish = (dir: 1 | -1) => {
    setLeaving(dir);
    setTimeout(() => {
      if (dir === 1) onAccept(); else onReject();
      setLeaving(0); setDx(0);
    }, 180);
  };

  const x = leaving ? leaving * 600 : dx;
  const p = Math.min(Math.abs(dx) / THRESHOLD, 1);
  const date = new Date(txn.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div
      className="absolute inset-0 touch-none select-none"
      style={{
        transform: depth ? `translateY(${depth * 10}px) scale(${1 - depth * 0.04})` : `translateX(${x}px) rotate(${x / 25}deg)`,
        transition: dragging ? "none" : "transform 180ms ease",
        zIndex: 10 - depth,
        opacity: depth > 1 ? 0 : 1,
      }}
      onPointerDown={depth ? undefined : (e) => { start.current = e.clientX; setDragging(true); (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={depth ? undefined : (e) => { if (start.current !== null) setDx(e.clientX - start.current); }}
      onPointerUp={depth ? undefined : () => {
        start.current = null; setDragging(false);
        if (dx > THRESHOLD) finish(1); else if (dx < -THRESHOLD) finish(-1); else setDx(0);
      }}
    >
      <div className="relative flex h-full flex-col rounded-xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(15,15,15,0.04),0_8px_24px_rgba(15,15,15,0.06)]">
        {!depth && (
          <>
            <div className="pointer-events-none absolute right-5 top-5 rounded border-2 border-[#448361] px-2 py-0.5 text-[13px] font-bold tracking-wide text-[#448361]" style={{ opacity: dx > 0 ? p : 0 }}>LOOKS RIGHT</div>
            <div className="pointer-events-none absolute left-5 top-5 rounded border-2 border-[#d44c47] px-2 py-0.5 text-[13px] font-bold tracking-wide text-[#d44c47]" style={{ opacity: dx < 0 ? p : 0 }}>CHANGE</div>
          </>
        )}
        <div className="mt-8 text-[13px] text-ink-3">{date}{txn.pending && " · Pending"}</div>
        <div className="mt-1 text-[22px] font-semibold leading-tight">{txn.merchant}</div>
        <div className={`mt-4 text-[40px] font-bold tracking-tight tabular ${txn.amount < 0 ? "text-[#448361]" : ""}`}>
          {txn.amount < 0 ? "+" : ""}{money2(Math.abs(txn.amount))}
        </div>
        <div className="mt-auto space-y-3 border-t border-line pt-4 text-[14px]">
          <Row label="Category"><CategoryTag id={txn.categoryId} /></Row>
          <Row label="Account">
            <span className="text-ink-2">{account ? `${account.institution} ${account.name} ··${account.mask}` : "—"}</span>
          </Row>
          <Row label="Suggested by">
            <span className="text-ink-2">{txn.categorySource === "rule" ? "Your past swipes" : "Plaid"}</span>
          </Row>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}
