import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

/**
 * Blocks new accounts until they confirm their email with a 6-digit code.
 * Shown whenever the logged-in profile reports email_verified === false.
 */
export function VerifyEmailModal() {
  const { session, profile, refetchProfile, signOut } = useAuth() as any;
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const sentRef = useRef(false);

  const needsVerification = !!session && !!profile && profile.email_verified === false;
  const open = needsVerification;

  useEffect(() => {
    if (!needsVerification) { sentRef.current = false; return; }
    if (sentRef.current) return;
    sentRef.current = true;
    sendCode();
  }, [needsVerification]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function sendCode() {
    try {
      setError(null);
      setCooldown(60);
      await customFetch<any>("/api/verify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: i18n.language?.slice(0, 2) || "de" }),
      });
    } catch {
      setError(t("verify.sendError"));
      setCooldown(5);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    try {
      setBusy(true);
      setError(null);
      await customFetch<any>("/api/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      // Keep the modal governed by the server-reported profile status. This
      // prevents a stale client state from granting access after confirmation.
      await refetchProfile();
      toast({ title: t("verify.success") });
      setCode("");
    } catch {
      setError(t("verify.wrongCode"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <Dialog open onOpenChange={() => { /* must verify or sign out */ }}>
      <DialogContent
        className="sm:max-w-[420px] bg-[var(--bg2)] border-[var(--border)] shadow-[var(--sh-lg)] rounded-[var(--r-lg)] p-8 [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-2">
            📧 {t("verify.title")}
          </DialogTitle>
          <DialogDescription className="text-center text-[var(--muted)] mb-4">
            {t("verify.description", { email: profile?.email || "" })}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 rounded-[var(--r)] border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={confirm} className="space-y-4">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="input text-center text-2xl tracking-[0.5em] font-bold"
            dir="ltr"
          />
          <button type="submit" className="btn btn-p btn-full" disabled={busy || code.length !== 6}>
            {busy ? <span className="spin" /> : null}
            {t("verify.submit")}
          </button>
        </form>

        <button
          type="button"
          className="w-full text-center text-sm text-[var(--muted)] mt-2 hover:text-[var(--brand)] transition-colors disabled:opacity-50"
          disabled={cooldown > 0}
          onClick={sendCode}
        >
          {cooldown > 0 ? t("verify.resendIn", { s: cooldown }) : t("verify.resend")}
        </button>
        <button
          type="button"
          className="w-full text-center text-xs text-[var(--muted)] mt-1 hover:text-[var(--brand)] transition-colors"
          onClick={() => signOut()}
        >
          {t("verify.signOut")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
