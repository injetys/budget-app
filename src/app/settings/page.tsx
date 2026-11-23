"use client";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useStore } from "@/lib/store";
import { PageTitle } from "@/components/Tag";
import { Section } from "@/components/ui";

export default function SettingsPage() {
  const { mode, user, accounts, txns, signOut, reload, reset } = useStore();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const onSuccess = useCallback(async (public_token: string | null, meta: { institution?: { name?: string } | null }) => {
    if (!public_token) return;
    setLinkToken(null); setBusy(true); setStatus("Importing transactions… this can take a minute.");
    const r = await fetch("/api/plaid/exchange", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token, institution: meta.institution?.name }),
    }).then((x) => x.json());
    setBusy(false);
    if (r.error) setStatus("⚠️ " + r.error);
    else { setStatus(`✓ Connected. Imported ${r.added} transactions.`); await reload(); }
  }, [reload]);

  const connect = async () => {
    setBusy(true); setStatus("");
    const r = await fetch("/api/plaid/link-token", { method: "POST" }).then((x) => x.json());
    setBusy(false);
    if (r.error) setStatus("⚠️ " + r.error); else setLinkToken(r.link_token);
  };

  const sync = async () => {
    setBusy(true); setStatus("Syncing…");
    const r = await fetch("/api/plaid/sync", { method: "POST" }).then((x) => x.json());
    setBusy(false);
    const errs = (r.results ?? []).filter((x: { error?: string }) => x.error);
    const n = (r.results ?? []).reduce((s: number, x: { added?: number }) => s + (x.added ?? 0), 0);
    setStatus(r.error ? "⚠️ " + r.error : errs.length ? "⚠️ " + errs.map((e: { institution: string; error: string }) => `${e.institution}: ${e.error}`).join("; ") : `✓ Up to date (${n} new).`);
    await reload();
  };

  const byInst = accounts.reduce<Record<string, typeof accounts>>((m, a) => ((m[a.institution || "Bank"] ??= []).push(a), m), {});

  return (
    <>
      <PageTitle icon="⚙️" title="Settings">{mode === "live" ? user?.email : "Demo mode"}</PageTitle>

      <Section title="Accounts">
        {Object.keys(byInst).length === 0 && <p className="text-[14px] text-ink-3">No accounts connected yet.</p>}
        {Object.entries(byInst).map(([inst, list]) => (
          <div key={inst} className="mb-3">
            <div className="mb-1 text-[12px] font-medium text-ink-3">🏦 {inst}</div>
            <div className="border-t border-line">
              {list.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b border-line py-2 text-[14px]">
                  <span>{a.name} <span className="text-ink-3">··{a.mask}</span></span>
                  <span className={`tag ${a.type === "credit" ? "tag-purple" : "tag-blue"}`}>{a.type === "credit" ? "Credit card" : a.type === "savings" ? "Savings" : "Checking"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {mode === "live" && (
          <div className="mt-4 flex gap-2">
            <button onClick={connect} disabled={busy} className="rounded-md bg-accent px-3 py-2 text-[14px] font-medium text-white disabled:opacity-60">+ Connect a bank or card</button>
            {accounts.length > 0 && <button onClick={sync} disabled={busy} className="rounded-md border border-line px-3 py-2 text-[14px] disabled:opacity-60">↻ Sync now</button>}
          </div>
        )}
        {status && <p className="mt-3 text-[13px] text-ink-2">{status}</p>}
        {linkToken && <PlaidOpener token={linkToken} onSuccess={onSuccess} onExit={() => setLinkToken(null)} />}
      </Section>

      <Section title="Account">
        <p className="mb-3 text-[13px] text-ink-3">{txns.length} transactions</p>
        <div className="flex gap-2">
          {mode === "demo" && <button onClick={reset} className="rounded-md border border-line px-3 py-2 text-[14px]">Reset demo data</button>}
          <button onClick={signOut} className="rounded-md border border-line px-3 py-2 text-[14px]">{mode === "demo" ? "Exit demo" : "Sign out"}</button>
        </div>
      </Section>
    </>
  );
}

function PlaidOpener({ token, onSuccess, onExit }: {
  token: string;
  onSuccess: (t: string | null, m: { institution?: { name?: string } | null }) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({ token, onSuccess, onExit });
  useEffect(() => { if (ready) open(); }, [ready, open]);
  return null;
}
