import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { AdminPanel } from "@/components/AdminPanel";
import { useAppState } from "@/lib/mock-store";

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

const ADMIN_USER = "admin";
const ADMIN_PASS = "AnandAdmin@2026";

function AdminLoginPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = () => {
    if (username.trim() !== ADMIN_USER || password !== ADMIN_PASS) {
      toast.error("Invalid administrator credentials.");
      return;
    }
    setUnlocked(true);
    toast.success("Welcome back, administrator");
  };

  if (unlocked && app) {
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
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
              <User className="h-4 w-4 text-brand" /> Username
            </p>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.slice(0, 40))}
              placeholder="Username"
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
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Password"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <button
            onClick={submit}
            className="w-full rounded-full bg-brand py-3.5 text-sm font-black uppercase tracking-wider text-brand-foreground active:scale-95"
          >
            Enter dashboard
          </button>
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
