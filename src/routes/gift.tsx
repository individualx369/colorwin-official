import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Gift, RefreshCw, Send, MessageCircle, History } from "lucide-react";
import { toast } from "sonner";
import { money, redeemGiftCode, timeAgo, useAppState } from "@/lib/mock-store";

export const Route = createFileRoute("/gift")({
  head: () => ({
    meta: [
      { title: "Gift Code Rewards — ColorWin" },
      {
        name: "description",
        content:
          "Redeem your ColorWin gift code for instant wallet bonus, and join our official Telegram and WhatsApp reward channels.",
      },
      { property: "og:title", content: "Gift Code Rewards — ColorWin" },
      {
        property: "og:description",
        content: "Enter a gift code, pass the security check and receive your bonus instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GiftPage,
});

const newCaptcha = () => String(Math.floor(1000 + Math.random() * 9000));

function GiftPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [answer, setAnswer] = useState("");
  const [captcha, setCaptcha] = useState(newCaptcha);

  const userId = app?.session?.userId ?? app?.userId;
  const history = (app?.redemptions ?? []).filter((r) => r.userId === userId);

  const receive = () => {
    if (!code.trim()) {
      toast.error("Please enter gift code");
      return;
    }
    if (answer !== captcha) {
      toast.error("Wrong verification code");
      setCaptcha(newCaptcha());
      setAnswer("");
      return;
    }
    const res = redeemGiftCode(code);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Successfully received ₹${money(res.amount)}`);
    setCode("");
    setAnswer("");
    setCaptcha(newCaptcha());
  };

  return (
    <div className="theme-light mx-auto min-h-screen max-w-md bg-background pb-12 text-foreground">
      <header className="bg-brand-gradient px-5 pb-16 pt-5 text-brand-foreground">
        <div className="flex items-center justify-between">
          <button
            onClick={() => void navigate({ to: "/" })}
            aria-label="Back to game"
            className="rounded-full p-1.5 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-black">Gift</h1>
          <span className="w-8" />
        </div>

        {/* Decorative reward box */}
        <div className="mt-6 flex flex-col items-center">
          <div className="relative grid h-24 w-28 place-items-end rounded-2xl bg-gold/95 shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-7 rounded-t-2xl bg-game-red" />
            <div className="absolute left-1/2 top-0 h-full w-4 -translate-x-1/2 bg-game-red/80" />
            <Gift className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 text-gold-foreground" />
          </div>
          <p className="mt-3 text-sm font-bold opacity-95">Enter your gift code and get a bonus</p>
        </div>
      </header>

      <main className="-mt-10 space-y-4 px-4">
        <section className="rounded-2xl bg-card p-5 shadow-xl">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 20))}
            placeholder="Please enter gift code"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
          />

          <div className="mt-3 flex items-center gap-2">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              placeholder="Verification code"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
            <div className="grid h-11 w-24 shrink-0 place-items-center rounded-xl bg-secondary font-mono text-lg font-black italic tracking-[0.2em] text-brand">
              {captcha}
            </div>
            <button
              onClick={() => setCaptcha(newCaptcha())}
              aria-label="Refresh verification code"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground active:scale-95"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={receive}
            className="mt-4 w-full rounded-full bg-brand py-3.5 text-sm font-black uppercase tracking-wider text-brand-foreground active:scale-95"
          >
            Receive
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Verified promo codes: GIFT50, WELCOME100 or BG678.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <a
            href="https://t.me"
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 shadow-md active:scale-95"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-brand-foreground">
              <Send className="h-6 w-6" />
            </span>
            <span className="text-sm font-black">Telegram</span>
            <span className="text-[11px] text-muted-foreground">Official channel</span>
          </a>
          <a
            href="https://wa.me"
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 shadow-md active:scale-95"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-game-green text-white">
              <MessageCircle className="h-6 w-6" />
            </span>
            <span className="text-sm font-black">WhatsApp</span>
            <span className="text-[11px] text-muted-foreground">Support group</span>
          </a>
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-md">
          <h2 className="flex items-center gap-2 text-sm font-black">
            <History className="h-4 w-4 text-brand" /> History
          </h2>
          {history.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No gift code claimed yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold">{r.code}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.at).toLocaleString("en-IN")} · {timeAgo(r.at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-brand">+₹{money(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
