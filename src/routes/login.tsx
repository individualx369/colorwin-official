import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, Lock, Eye, EyeOff, ShieldCheck, Gift, ArrowLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  loginAccount,
  resendSignupOtp,
  setNewPassword,
  startPasswordReset,
  startRegistration,
  verifyPasswordResetOtp,
  verifyRegistration,
} from "@/lib/store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in or Register — ColorWin" },
      {
        name: "description",
        content:
          "Log in to ColorWin with your mobile number and password, or register a new account verified by a one-time SMS code.",
      },
      { property: "og:title", content: "Log in or Register — ColorWin" },
      { property: "og:description", content: "Access your ColorWin wallet, bets and rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

type Screen = "login" | "register" | "forgot";

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("login");

  const done = (msg: string) => {
    toast.success(msg);
    router.invalidate();
    void navigate({ to: "/" });
  };

  const heading =
    screen === "login" ? "Log in" : screen === "register" ? "Register" : "Reset password";
  const subtitle =
    screen === "login"
      ? "Log in with your mobile number and password"
      : screen === "register"
        ? "Register with your mobile number — we send a one-time code"
        : "Verify your mobile number to set a new password";

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
        <h1 className="mt-6 text-2xl font-black">{heading}</h1>
        <p className="mt-1 text-sm opacity-90">{subtitle}</p>
      </header>

      <div className="-mt-6 px-4">
        <div className="rounded-2xl bg-card p-5 shadow-xl">
          {screen === "login" && (
            <LoginForm
              onDone={done}
              onRegister={() => setScreen("register")}
              onForgot={() => setScreen("forgot")}
            />
          )}
          {screen === "register" && (
            <RegisterForm onDone={done} onLogin={() => setScreen("login")} />
          )}
          {screen === "forgot" && <ForgotForm onDone={done} onLogin={() => setScreen("login")} />}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-brand" />
          100% Secure System 🔐 — your account is protected on our official server network.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ login */

function LoginForm({
  onDone,
  onRegister,
  onForgot,
}: {
  onDone: (msg: string) => void;
  onRegister: () => void;
  onForgot: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (phone.length !== 10 || !password) {
      toast.error("Enter your 10-digit mobile number and password.");
      return;
    }
    setBusy(true);
    const res = await loginAccount(phone, password);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onDone("Logged in successfully");
  };

  return (
    <div className="space-y-4">
      <PhoneField value={phone} onChange={setPhone} />

      <Field label="Password" icon={<Lock className="h-4 w-4 text-brand" />}>
        <div className="flex items-center gap-2">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={show ? "text" : "password"}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
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

      <div className="flex justify-end text-xs">
        <button onClick={onForgot} className="font-semibold text-brand">
          Forgot password?
        </button>
      </div>

      <PrimaryButton onClick={() => void submit()} busy={busy} busyLabel="Logging in…">
        Log in
      </PrimaryButton>
      <SecondaryButton onClick={onRegister}>Register</SecondaryButton>
    </div>
  );
}

/* --------------------------------------------------------------- register */

function RegisterForm({ onDone, onLogin }: { onDone: (msg: string) => void; onLogin: () => void }) {
  const [step, setStep] = useState<"details" | "otp">("details");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [otp, setOtp] = useState("");
  const [invite, setInvite] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendOtp = async () => {
    const error =
      phone.length !== 10
        ? "Enter a valid 10-digit mobile number."
        : password.length < 6
          ? "Password must be at least 6 characters."
          : password !== confirm
            ? "Passwords do not match."
            : !agree
              ? "Please accept the Privacy Agreement."
              : null;
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    const res = await startRegistration(phone, password);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStep("otp");
    toast.success(`Verification code sent to +91 ${phone}`);
  };

  const verify = async () => {
    if (otp.trim().length < 4) {
      toast.error("Enter the verification code from the SMS.");
      return;
    }
    setBusy(true);
    const res = await verifyRegistration(phone, otp, invite.trim() ? `Player ${invite.trim()}` : undefined);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onDone("Registered successfully");
  };

  const resend = async () => {
    const res = await resendSignupOtp(phone);
    toast[res.ok ? "success" : "error"](res.ok ? "New code sent" : res.error);
  };

  if (step === "otp") {
    return (
      <OtpStep
        phone={phone}
        otp={otp}
        setOtp={setOtp}
        busy={busy}
        onVerify={() => void verify()}
        onResend={() => void resend()}
        onBack={() => setStep("details")}
        verifyLabel="Verify & create account"
      />
    );
  }

  return (
    <div className="space-y-4">
      <PhoneField value={phone} onChange={setPhone} />

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

      <PrimaryButton onClick={() => void sendOtp()} busy={busy} busyLabel="Sending code…">
        Send OTP
      </PrimaryButton>
      <SecondaryButton onClick={onLogin}>I have an account · Log in</SecondaryButton>
    </div>
  );
}

/* ------------------------------------------------------------- forgot flow */

function ForgotForm({ onDone, onLogin }: { onDone: (msg: string) => void; onLogin: () => void }) {
  const [step, setStep] = useState<"phone" | "otp" | "password">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (phone.length !== 10) {
      toast.error("Enter your registered 10-digit mobile number.");
      return;
    }
    setBusy(true);
    const res = await startPasswordReset(phone);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStep("otp");
    toast.success(`Reset code sent to +91 ${phone}`);
  };

  const verify = async () => {
    setBusy(true);
    const res = await verifyPasswordResetOtp(phone, otp);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStep("password");
  };

  const save = async () => {
    if (password.length < 6 || password !== confirm) {
      toast.error("Enter matching passwords of at least 6 characters.");
      return;
    }
    setBusy(true);
    const res = await setNewPassword(phone, password);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onDone("Password updated successfully");
  };

  if (step === "otp") {
    return (
      <OtpStep
        phone={phone}
        otp={otp}
        setOtp={setOtp}
        busy={busy}
        onVerify={() => void verify()}
        onResend={() => void send()}
        onBack={() => setStep("phone")}
        verifyLabel="Verify code"
      />
    );
  }

  if (step === "password") {
    return (
      <div className="space-y-4">
        <Field label="New password" icon={<Lock className="h-4 w-4 text-brand" />}>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="New password"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </Field>
        <Field label="Confirm new password" icon={<Lock className="h-4 w-4 text-brand" />}>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            type="password"
            placeholder="Confirm new password"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </Field>
        <PrimaryButton onClick={() => void save()} busy={busy} busyLabel="Saving…">
          Save new password
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PhoneField value={phone} onChange={setPhone} />
      <PrimaryButton onClick={() => void send()} busy={busy} busyLabel="Sending code…">
        Send reset OTP
      </PrimaryButton>
      <SecondaryButton onClick={onLogin}>Back to log in</SecondaryButton>
    </div>
  );
}

/* ------------------------------------------------------------------- bits */

function OtpStep({
  phone,
  otp,
  setOtp,
  busy,
  onVerify,
  onResend,
  onBack,
  verifyLabel,
}: {
  phone: string;
  otp: string;
  setOtp: (v: string) => void;
  busy: boolean;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
  verifyLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-secondary p-3 text-center text-xs font-semibold text-muted-foreground">
        We sent a one-time verification code by SMS to
        <span className="ml-1 font-black text-foreground">+91 {phone}</span>
      </div>

      <Field label="Verification code" icon={<KeyRound className="h-4 w-4 text-brand" />}>
        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter the code"
          className="w-full bg-transparent py-2 text-center text-lg font-black tracking-[0.5em] outline-none"
        />
      </Field>

      <PrimaryButton onClick={onVerify} busy={busy} busyLabel="Verifying…">
        {verifyLabel}
      </PrimaryButton>
      <div className="flex items-center justify-between text-xs font-semibold">
        <button onClick={onBack} className="text-muted-foreground">
          Change number
        </button>
        <button onClick={onResend} className="text-brand">
          Resend code
        </button>
      </div>
    </div>
  );
}

function PhoneField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Mobile number" icon={<Phone className="h-4 w-4 text-brand" />}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-2 text-sm font-bold">+91</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          autoComplete="tel"
          placeholder="Please enter the mobile number"
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
      </div>
    </Field>
  );
}

function PrimaryButton({
  onClick,
  busy,
  busyLabel,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  busyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full rounded-full bg-brand py-3.5 text-sm font-black uppercase tracking-wider text-brand-foreground active:scale-95 disabled:opacity-60"
    >
      {busy ? busyLabel : children}
    </button>
  );
}

function SecondaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-full border border-brand py-3.5 text-sm font-black uppercase tracking-wider text-brand active:scale-95"
    >
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
