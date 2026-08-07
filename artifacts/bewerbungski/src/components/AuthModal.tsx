import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, Trans } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function AuthModal() {
  const { showAuthModal, setShowAuthModal, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      setLoading(true);
      await signIn(email);
      setSent(true);
      toast({
        title: t("auth.sentToast"),
        description: t("auth.sentToastDesc"),
      });
    } catch (error: any) {
      toast({
        title: t("auth.errorTitle"),
        description: error.message || t("auth.errorGeneric"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
      <DialogContent className="sm:max-w-[420px] bg-[var(--bg2)] border-[var(--border)] shadow-[var(--sh-lg)] rounded-[var(--r-lg)] p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-2">{t("auth.title")}</DialogTitle>
          <DialogDescription className="text-center text-[var(--muted)] mb-6">
            {t("auth.description")}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="text-center p-6 bg-[var(--brand-l)] text-[var(--brand)] rounded-[var(--r)] mb-4 font-medium">
            <Trans i18nKey="auth.sentTo" values={{ email }} components={{ 1: <strong /> }} />
          </div>
        ) : (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="field">
              <Label className="label">{t("auth.emailLabel")}</Label>
              <Input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
              />
            </div>
            <button
              type="submit"
              className="btn btn-p btn-full"
              disabled={loading || !email}
            >
              {loading ? <span className="spin" /> : null}
              {loading ? t("auth.sending") : t("auth.send")}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
