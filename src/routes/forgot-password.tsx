import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark, LogoWord } from "@/components/app/logo";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forget-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo: "/login" }),
      });
      if (!res.ok) {
        throw new Error(
          "Password reset email is not configured on this server. Sign in and change your password from Settings, or contact the administrator.",
        );
      }
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Password reset email is not configured on this server. Sign in and change your password from Settings, or contact the administrator.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <LogoMark />
          <LogoWord />
        </div>
        <h1 className="text-xl font-semibold">Reset password</h1>
        {sent ? (
          <p className="mt-3 text-sm text-muted-foreground">
            If an account exists for that email, a reset link will be sent. Check your inbox.
          </p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              Send reset link
            </Button>
          </form>
        )}
        <Link to="/login" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
