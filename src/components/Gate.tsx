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
 * Email + password. (On iPhone a home-screen app doesn't share Safari's login, so
 * email links can't sign you in — they're only used once to confirm your address.)
 */
function SignIn() {
  const { startDemo } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"signin" | "signup" | "check-email">("signin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true); setErr("");
    const sb = supabase();
    if (step === "signup") {
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      if (error) return setErr(error.message);
      if (!data.session) setStep("check-email");
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) setErr(error.message === "Email not confirmed" ? "Confirm your email first — check your inbox for the link." : error.message);
    }
  };

  const field = "w-full rounded-md border border-line bg-soft px-3 py-2.5 text-[16px] outline-none focus:border-accent focus:bg-white";

  return (
    <div className="mx-auto max-w-[360px] pt-16">
      <div className="text-[44px] leading-none">💸</div>
      <h1 className="mt-3 text-[32px] font-bold tracking-tight">Budget</h1>

      {step === "check-email" ? (
        <>
          <p className="mt-3 text-[15px] text-ink-2">
            We sent a confirmation link to <b>{email}</b>. Tap it (it opens in Safari — that&apos;s fine), then come back here and sign in.
          </p>
          <button onClick={() => setStep("signin")} className="mt-6 w-full rounded-md bg-accent py-2.5 text-[15px] font-medium text-white">I confirmed — sign in</button>
        </>
      ) : (
        <>
          <p className="mt-1 text-[15px] text-ink-2">{step === "signup" ? "Create your account." : "Sign in to your account."}</p>
          <form className="mt-8 space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            <input type="password" required minLength={8} autoComplete={step === "signup" ? "new-password" : "current-password"}
              placeholder={step === "signup" ? "Password (8+ characters)" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
            <button disabled={busy} className="w-full rounded-md bg-accent py-2.5 text-[15px] font-medium text-white disabled:opacity-60">
              {busy ? "…" : step === "signup" ? "Create account" : "Sign in"}
            </button>
            {err && <p className="text-[13px] text-[#d44c47]">{err}</p>}
          </form>
          <div className="mt-6 flex justify-between text-[13px] text-ink-3">
            <button onClick={() => { setStep(step === "signup" ? "signin" : "signup"); setErr(""); }}>
              {step === "signup" ? "Have an account? Sign in" : "New here? Create account"}
            </button>
            <button onClick={startDemo}>Try the demo</button>
          </div>
        </>
      )}
    </div>
  );
}
