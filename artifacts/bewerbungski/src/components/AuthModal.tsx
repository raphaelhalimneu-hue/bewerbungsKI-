import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function AuthModal() {
  const { showAuthModal, setShowAuthModal, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      setLoading(true);
      await signIn(email);
      setSent(true);
      toast({
        title: "E-Mail wurde versendet ✓",
        description: "Bitte überprüfe deinen Posteingang.",
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Ein Fehler ist aufgetreten.",
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
          <DialogTitle className="text-2xl font-bold text-center mb-2">Anmelden / Registrieren</DialogTitle>
          <DialogDescription className="text-center text-[var(--muted)] mb-6">
            Logge dich mit deiner E-Mail-Adresse ein. Kein Passwort nötig.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="text-center p-6 bg-[var(--brand-l)] text-[var(--brand)] rounded-[var(--r)] mb-4 font-medium">
            ✨ Magischer Link wurde an <strong>{email}</strong> gesendet.
          </div>
        ) : (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="field">
              <Label className="label">E-Mail Adresse</Label>
              <Input
                type="email"
                placeholder="max.mustermann@email.de"
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
              {loading ? "Wird gesendet..." : "Magic Link senden"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
