"use client";
import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import { TabBar } from "./TabBar";

/** Shows the sign-in screen until you're signed in (or chose the demo). */
export function Gate({ children }: { children: ReactNode }) {
  const { mode } = useStore();
  if (mode === "loading") return <div className="pt-32 text-center text-ink-3">Loading…</div>;
  if (mode === "signed-out") return <SignIn />;
  return (
    <>
      {mode === "demo" && (
        <div className="mb-4 rounded-md bg-[#fbf3db] px-3 py-2 text-[13px] text-[#9f6b18]">Demo mode — sample data, nothing is saved to your account.</div>
      )}
      {children}
      <TabBar />
    </>
  );
}

/**
 * Email code sign-in (not a magic link): on iPhone, a home-screen app doesn't share
 * Safari's login, so you type the code into the app itself.
 */
function SignIn() {
  const { startDemo } = useStore();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setErr(error.message); else setStep("code");
  };
  const verify = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setErr(error.message);
  };

  return (
    <div className="mx-auto max-w-[360px] pt-16">
      <div className="text-[44px] leading-none">💸</div>
      <h1 className="mt-3 text-[32px] font-bold tracking-tight">Budget</h1>
      <p className="mt-1 text-[15px] text-ink-2">{step === "email" ? "Sign in with your email." : `Enter the code we sent to ${email}.`}</p>

      <form className="mt-8 space-y-3" onSubmit={(e) => { e.preventDefault(); if (step === "email") send(); else verify(); }}>
        {step === "email" ? (
          <input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line bg-soft px-3 py-2.5 text-[16px] outline-none focus:border-accent focus:bg-white" />
        ) : (
          <input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-md border border-line bg-soft px-3 py-2.5 text-center text-[22px] tracking-[0.3em] outline-none focus:border-accent focus:bg-white tabular" />
        )}
        <button disabled={busy} className="w-full rounded-md bg-accent py-2.5 text-[15px] font-medium text-white disabled:opacity-60">
          {busy ? "…" : step === "email" ? "Email me a code" : "Sign in"}
        </button>
        {err && <p className="text-[13px] text-[#d44c47]">{err}</p>}
      </form>

      <div className="mt-6 flex justify-between text-[13px] text-ink-3">
        {step === "code" ? <button onClick={() => { setStep("email"); setCode(""); }}>← Different email</button> : <span />}
        <button onClick={startDemo}>Try the demo</button>
      </div>
    </div>
  );
}
