import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { AdminPanel } from "@/components/AdminPanel";
import { useAppState, emailForPhone, loginWithEmail, refresh } from "@/lib/store";
import { claimAdminRole } from "@/lib/api.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Staff Access — ColorWin" },
      { name: "description", content: "Restricted staff access area for ColorWin operations." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Staff Access — ColorWin" },
      { property: "og:description", content: "Restricted staff access area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLoginPage,
});

/** Accepts an email address or a 10-digit staff phone number. */
const toEmail = (identity: string) =>
  identity.includes("@") ? identity.trim() : emailForPhone(identity);

function AdminLoginPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "create">("login");

  const finish = async () => {
    try {
      await claimAdminRole();
      refresh();
      toast.success("Welcome back, administrator");
    } catch (error) {
      toast.error((error as Error).message);
    }
    setBusy(false);
  };

  const submit = async () => {
    const email = toEmail(identity);
    if (!email.includes("@") || password.length < 6) {
      toast.error("Enter a valid staff email/phone and a password of 6+ characters.");
      return;
    }
    setBusy(true);

    if (mode === "create") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setBusy(false);
        toast.error(error.message);
        return;
      }
      await finish();
      return;
    }

    const res = await loginWithEmail(email, password);
    if (!res.ok) {
      setBusy(false);
      toast.error(res.error);
      return;
    }
    await finish();
  };

  if (app?.isAdmin) {
    return <AdminPanel state={app} onClose={() => void navigate({ to: "/" })} />;
  }

  return (
    <div className="theme-light mx-auto flex min-h-screen max-w-md flex-col bg-background text-foreground">
      <header className="bg-brand-gradient px-5 pb-14 pt-10 text-brand-foreground">
        <ShieldCheck className="h-9 w-9" />
        <h1 className="mt-3 text-2xl font-black">Staff Access</h1>
        <p className="mt-1 text-sm opacity-90">Authorised personnel only</p>
      </header>

      <div className="-mt-8 px-4">
        <div className="space-y-4 rounded-2xl bg-card p-5 shadow-xl">
          <div className="flex gap-2">
            {(["login", "create"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full py-2 text-[11px] font-black uppercase ${
                  mode === m ? "bg-brand text-brand-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {m === "login" ? "Sign in" : "Create admin"}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
              <User className="h-4 w-4 text-brand" /> Staff email or phone
            </p>
            <input
              value={identity}
              onChange={(e) => setIdentity(e.target.value.slice(0, 60))}
              placeholder="admin@colorwin.app"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
              <Lock className="h-4 w-4 text-brand" /> Password
            </p>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, 60))}
              type="password"
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="Password"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="w-full rounded-full bg-brand py-3.5 text-sm font-black uppercase tracking-wider text-brand-foreground active:scale-95 disabled:opacity-60"
          >
            {busy ? "Checking…" : mode === "create" ? "Create administrator" : "Enter dashboard"}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            The first account created here becomes the owner administrator. Afterwards only that
            account can open the dashboard.
          </p>
          <button
            onClick={() => void navigate({ to: "/" })}
            className="w-full text-center text-xs font-semibold text-muted-foreground"
          >
            Back to app
          </button>
        </div>
      </div>
    </div>
  );
}
