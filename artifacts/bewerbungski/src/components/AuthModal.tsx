import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function AuthModal() {
  const { showAuthModal, setShowAuthModal, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      setLoading(true);
      if (isSignUp) {
        await signUp(email, password);
        toast({ title: t("auth.successSignUp") });
      } else {
        await signIn(email, password);
        toast({ title: t("auth.successSignIn") });
      }
      setShowAuthModal(false);
    } catch (error: any) {
      const msg =
        error.message === "EMAIL_EXISTS"
          ? t("auth.emailExists")
          : /invalid login credentials/i.test(error.message || "")
            ? t("auth.wrongCredentials")
            : error.message || t("auth.errorGeneric");
      toast({
        title: t("auth.errorTitle"),
        description: msg,
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
          <DialogTitle className="text-2xl font-bold text-center mb-2">
            {isSignUp ? t("auth.titleSignUp") : t("auth.titleSignIn")}
          </DialogTitle>
          <DialogDescription className="text-center text-[var(--muted)] mb-6">
            {t("auth.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="field">
            <Label className="label">{t("auth.passwordLabel")}</Label>
            <Input
              type="password"
              placeholder={t("auth.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="input"
            />
          </div>
          <button
            type="submit"
            className="btn btn-p btn-full"
            disabled={loading || !email || !password}
          >
            {loading ? <span className="spin" /> : null}
            {loading
              ? (isSignUp ? t("auth.signingUp") : t("auth.signingIn"))
              : (isSignUp ? t("auth.signUp") : t("auth.signIn"))}
          </button>
        </form>

        <button
          type="button"
          className="w-full text-center text-sm text-[var(--muted)] mt-2 hover:text-[var(--brand)] transition-colors"
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp ? t("auth.toggleToSignIn") : t("auth.toggleToSignUp")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
