import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, Lock, Mail, Eye, EyeOff, ShieldCheck, Gift, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { loginAccount, registerAccount, useAppState } from "@/lib/mock-store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in or Register — ColorWin" },
      {
        name: "description",
        content:
          "Log in to ColorWin with your phone number or email, or register a new account with an invite code to start playing.",
      },
      { property: "og:title", content: "Log in or Register — ColorWin" },
      { property: "og:description", content: "Access your ColorWin wallet, bets and rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

type Screen = "login" | "register";
type LoginTab = "phone" | "email";

function LoginPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("login");

  const done = (msg: string) => {
    toast.success(msg);
    router.invalidate();
    void navigate({ to: "/" });
  };

  return (
    <div className="theme-light mx-auto min-h-screen max-w-md bg-background pb-10 text-foreground">
      <header className="bg-brand-gradient px-5 pb-10 pt-6 text-brand-foreground">
        <div className="flex items-center justify-between">
          <button
            onClick={() => void navigate({ to: "/" })}
            aria-label="Back to game"
            className="rounded-full p-1.5 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-black tracking-tight">ColorWin</span>
          <Gift className="h-5 w-5 opacity-80" />
        </div>
        <h1 className="mt-6 text-2xl font-black">
          {screen === "login" ? "Log in" : "Register"}
        </h1>
        <p className="mt-1 text-sm opacity-90">
          {screen === "login"
            ? "Please log in with your phone number or email"
            : "Please register with your phone number to continue"}
        </p>
      </header>

      <div className="-mt-6 px-4">
        <div className="rounded-2xl bg-card p-5 shadow-xl">
          {screen === "login" ? (
            <LoginForm
              onDone={done}
              onRegister={() => setScreen("register")}
              hasAccounts={(app?.accounts.length ?? 0) > 0}
            />
          ) : (
            <RegisterForm onDone={done} onLogin={() => setScreen("login")} />
          )}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-brand" />
          Demo mode — accounts are stored locally on this device only.
        </p>
      </div>
    </div>
  );
}

function LoginForm({
  onDone,
  onRegister,
  hasAccounts,
}: {
  onDone: (msg: string) => void;
  onRegister: () => void;
  hasAccounts: boolean;
}) {
  const [tab, setTab] = useState<LoginTab>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);

  const submit = () => {
    const identity = tab === "phone" ? phone.replace(/\D/g, "") : email.trim();
    if (!identity || !password) {
      toast.error("Please fill in all fields.");
      return;
    }
    const res = loginAccount(identity, password);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onDone("Logged in successfully");
  };

  return (
    <>
      <div className="flex gap-2">
        <TabButton active={tab === "phone"} onClick={() => setTab("phone")} icon={<Phone className="h-4 w-4" />}>
          Log in with phone
        </TabButton>
        <TabButton active={tab === "email"} onClick={() => setTab("email")} icon={<Mail className="h-4 w-4" />}>
          Email login
        </TabButton>
      </div>

      <div className="mt-5 space-y-4">
        {tab === "phone" ? (
          <Field label="Phone number" icon={<Phone className="h-4 w-4 text-brand" />}>
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-2 text-sm font-bold">+91</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                placeholder="Please enter the phone number"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>
          </Field>
        ) : (
          <Field label="Email" icon={<Mail className="h-4 w-4 text-brand" />}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Please enter the email"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </Field>
        )}

        <Field label="Password" icon={<Lock className="h-4 w-4 text-brand" />}>
          <div className="flex items-center gap-2">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={show ? "text" : "password"}
              placeholder="Please enter the password"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
            <button onClick={() => setShow((v) => !v)} aria-label="Toggle password visibility">
              {show ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 font-semibold text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Remember password
          </label>
          <button
            onClick={() => toast.info("Please contact customer support to reset your password.")}
            className="font-semibold text-brand"
          >
            Forgot password?
          </button>
        </div>

        <button
          onClick={submit}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-black uppercase tracking-wider text-brand-foreground active:scale-95"
        >
          Log in
        </button>
        <button
          onClick={onRegister}
          className="w-full rounded-full border border-brand py-3.5 text-sm font-black uppercase tracking-wider text-brand active:scale-95"
        >
          Register
        </button>
        {!hasAccounts && (
          <p className="text-center text-[11px] text-muted-foreground">
            No account yet? Register first — it takes a few seconds.
          </p>
        )}
      </div>
    </>
  );
}

function RegisterForm({ onDone, onLogin }: { onDone: (msg: string) => void; onLogin: () => void }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [sms, setSms] = useState("");
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [invite, setInvite] = useState("");
  const [agree, setAgree] = useState(false);

  const sendCode = () => {
    if (phone.length !== 10) {
      toast.error("Enter a valid 10-digit phone number first.");
      return;
    }
    const code = String(Math.floor(1000 + Math.random() * 9000));
    setSentCode(code);
    toast.success(`SMS code sent: ${code}`);
  };

  const submit = () => {
    if (phone.length !== 10) return toast.error("Enter a valid 10-digit phone number.");
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    if (!sentCode || sms !== sentCode) return toast.error("Invalid SMS verification code.");
    if (!agree) return toast.error("Please accept the Privacy Agreement.");
    const res = registerAccount(phone, password, invite.trim() || undefined);
    if (!res.ok) return toast.error(res.error);
    onDone("Registered successfully");
  };

  return (
    <div className="space-y-4">
      <Field label="Phone number" icon={<Phone className="h-4 w-4 text-brand" />}>
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-2 text-sm font-bold">+91</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            placeholder="Please enter the phone number"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
      </Field>

      <Field label="Set password" icon={<Lock className="h-4 w-4 text-brand" />}>
        <div className="flex items-center gap-2">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={show ? "text" : "password"}
            placeholder="Set password"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
          <button onClick={() => setShow((v) => !v)} aria-label="Toggle password visibility">
            {show ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </Field>

      <Field label="Confirm password" icon={<Lock className="h-4 w-4 text-brand" />}>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          type={show ? "text" : "password"}
          placeholder="Confirm password"
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
      </Field>

      <Field label="SMS verification code" icon={<ShieldCheck className="h-4 w-4 text-brand" />}>
        <div className="flex items-center gap-2">
          <input
            value={sms}
            onChange={(e) => setSms(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="Please enter the code"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
          <button
            onClick={sendCode}
            className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-xs font-black uppercase text-brand-foreground active:scale-95"
          >
            Send
          </button>
        </div>
      </Field>

      <Field label="Invite code (optional)" icon={<Gift className="h-4 w-4 text-brand" />}>
        <input
          value={invite}
          onChange={(e) => setInvite(e.target.value.toUpperCase().slice(0, 12))}
          placeholder="Please enter the invite code"
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
      </Field>

      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
        />
        <span>
          I have read and agree <span className="font-bold text-brand">【Privacy Agreement】</span>
        </span>
      </label>

      <button
        onClick={submit}
        className="w-full rounded-full bg-brand py-3.5 text-sm font-black uppercase tracking-wider text-brand-foreground active:scale-95"
      >
        Register
      </button>
      <button
        onClick={onLogin}
        className="w-full rounded-full border border-brand py-3.5 text-sm font-black uppercase tracking-wider text-brand active:scale-95"
      >
        I have an account · Log in
      </button>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-black ${
        active ? "bg-brand text-brand-foreground" : "bg-secondary text-muted-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-foreground">
        {icon}
        {label}
      </p>
      <div className="rounded-xl border border-input bg-background px-3">{children}</div>
    </div>
  );
}
