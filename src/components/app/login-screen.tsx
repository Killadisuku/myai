import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark, LogoWord } from "@/components/app/logo";

type DeployStatus = { ready: boolean; database: boolean; ai: boolean };

export function LoginScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [onVercel, setOnVercel] = useState(false);
  const [status, setStatus] = useState<DeployStatus | null>(null);

  useEffect(() => {
    setOnVercel(/\.(vercel\.app)$/i.test(window.location.hostname));
    void fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DeployStatus | null) => {
        if (data && typeof data.database === "boolean") setStatus(data);
      })
      .catch(() => {});
  }, []);

  const needsSetup = Boolean(onVercel && status && (!status.database || !status.ai));
  const showOauth = !onVercel;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0],
        });
        if (err) throw new Error(err.message || "Could not create the account.");
      }
      const { error: err } = await authClient.signIn.email({ email, password, callbackURL: "/" });
      if (err) throw new Error(err.message || "Could not sign in.");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <LogoWord className="text-xl" />
            <p className="text-sm text-muted-foreground">Your AI. Your terms.</p>
          </div>
        </div>
        {needsSetup && (
          <div className="mb-4 rounded-[20px] border border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
            This Vercel deploy still needs a database and an AI key before accounts
            and chats will stick. Add <span className="text-foreground">DATABASE_URL</span>,{" "}
            <span className="text-foreground">BETTER_AUTH_SECRET</span>, and{" "}
            <span className="text-foreground">XAI_API_KEY</span> in the project settings,
            then redeploy.
          </div>
        )}
        <div className="rounded-[28px] border border-border bg-card p-6 shadow-[var(--shadow)]">
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "in" ? "Sign in" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "in"
              ? "Welcome back."
              : showOauth
                ? "Email and a password, or continue with Google."
                : "Email and a password."}
          </p>
          {authEnabled ? (
            <>
              {showOauth && (
                <>
                  <div className="mt-5 grid gap-2">
                    {GROK_PROVIDERS.map((p) => (
                      <Button
                        key={p.providerId}
                        type="button"
                        variant="outline"
                        className="h-11 w-full"
                        onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
                      >
                        Continue with {p.label}
                      </Button>
                    ))}
                  </div>
                  <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    or
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}
              <form onSubmit={(e) => void onSubmit(e)} className={`space-y-3 ${showOauth ? "" : "mt-5"}`}>
                {mode === "up" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="h-11 w-full" disabled={busy}>
                  {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
                </Button>
              </form>
              <div className="mt-4 flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setMode(mode === "in" ? "up" : "in")}
                >
                  {mode === "in" ? "Create an account" : "Already have an account"}
                </button>
                <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">
                  Forgot password
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Sign-in is disabled.</p>
          )}
        </div>
      </div>
    </main>
  );
}

export function AuthSplash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background">
      <LogoMark className="size-12" />
      <p className="text-lg font-semibold tracking-tight">MyAI</p>
      <p className="text-sm text-muted-foreground">Your AI. Your terms.</p>
    </div>
  );
}
