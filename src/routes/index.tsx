import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trophy,
  X,
  History,
  Ticket,
  Clock,
  MessageCircle,
  Receipt,
  Send,
  Gift,
  LogOut,
} from "lucide-react";
import {
  useAppState,
  adjustBalance,
  syncBets,
  logout,
  money as fmt,
  timeAgo,
} from "@/lib/mock-store";
import { DepositModal } from "@/components/DepositModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { SupportChat } from "@/components/SupportChat";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ColorWin — Color Prediction Game" },
      {
        name: "description",
        content:
          "Predict Red, Green or Violet and win up to 9x. Fast 30-second rounds, wallet with deposit and withdraw, live game history.",
      },
      { property: "og:title", content: "ColorWin — Color Prediction Game" },
      {
        property: "og:description",
        content: "Predict Red, Green or Violet and win up to 9x. Fast rounds, instant results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type ColorChoice = "red" | "green" | "violet";
type BetTarget = ColorChoice | number;
type ModeId = "30s" | "1min" | "3min" | "5min";

interface RoundResult {
  period: string;
  number: number;
  colors: ColorChoice[];
}

interface PlacedBet {
  id: string;
  mode: ModeId;
  period: string;
  target: BetTarget;
  label: string;
  amount: number;
  status: "pending" | "won" | "lost";
  payout: number;
}

const MODES: { id: ModeId; label: string; seconds: number }[] = [
  { id: "30s", label: "Win Go 30s", seconds: 30 },
  { id: "1min", label: "Win Go 1Min", seconds: 60 },
  { id: "3min", label: "Win Go 3Min", seconds: 180 },
  { id: "5min", label: "Win Go 5Min", seconds: 300 },
];

const BET_AMOUNTS = [10, 100, 1000, 10000];

function periodFromDate(d: Date, roundSeconds: number) {
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const secondsSinceMidnight = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  const roundIndex = Math.floor(secondsSinceMidnight / roundSeconds);
  return `${ymd}${String(roundIndex).padStart(4, "0")}`;
}

function secondsLeftInRound(d: Date, roundSeconds: number) {
  const s = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  return roundSeconds - (s % roundSeconds);
}

function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function drawResult(period: string): RoundResult {
  const number = Math.floor(Math.random() * 10);
  const colors: ColorChoice[] =
    number === 0
      ? ["red", "violet"]
      : number === 5
        ? ["green", "violet"]
        : number % 2 === 0
          ? ["red"]
          : ["green"];
  return { period, number, colors };
}


const colorStyles: Record<ColorChoice, string> = {
  red: "bg-game-red text-white",
  green: "bg-game-green text-white",
  violet: "bg-game-violet text-white",
};

function Index() {
  const app = useAppState();
  const hydrated = app !== null;
  const balance = app?.balance ?? 0;
  const transactions = app?.transactions ?? [];
  const tickets = app?.tickets ?? [];
  const [now, setNow] = useState<Date | null>(null);
  const [mode, setMode] = useState<ModeId>("30s");
  const [historyByMode, setHistoryByMode] = useState<Record<ModeId, RoundResult[]>>({
    "30s": [],
    "1min": [],
    "3min": [],
    "5min": [],
  });
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [tab, setTab] = useState<"history" | "bets">("history");
  const [betTarget, setBetTarget] = useState<BetTarget | null>(null);
  const [walletModal, setWalletModal] = useState<"deposit" | "withdraw" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "transactions">("none");
  const [supportOpen, setSupportOpen] = useState(false);
  const [lock, setLock] = useState<"recharge" | "security" | null>(null);
  const navigate = useNavigate();
  const tapRef = useRef<number[]>([]);
  const settlingRef = useRef<Record<string, string | null>>({});
  const paidRef = useRef<Record<string, boolean>>({});

  const activeMode = MODES.find((m) => m.id === mode)!;
  const period = now ? periodFromDate(now, activeMode.seconds) : "…";
  const secondsLeft = now ? secondsLeftInRound(now, activeMode.seconds) : 0;
  const bettingClosed = !now || secondsLeft <= 5;
  const history = historyByMode[mode];

  // countdown ticker + round settlement (all modes run independently)
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNow(d);
      for (const m of MODES) {
        const p = periodFromDate(d, m.seconds);
        if (
          secondsLeftInRound(d, m.seconds) === m.seconds &&
          settlingRef.current[m.id] !== p
        ) {
          // a new round just started -> settle the previous one
          const prevDate = new Date(d.getTime() - 1000);
          const prevPeriod = periodFromDate(prevDate, m.seconds);
          const result = drawResult(prevPeriod);
          settlingRef.current[m.id] = p;
          setHistoryByMode((h) => ({ ...h, [m.id]: [result, ...h[m.id]].slice(0, 30) }));
          setBets((prev) => {
            let wonTotal = 0;
            const next = prev.map((b) => {
              if (b.status !== "pending" || b.mode !== m.id || b.period !== prevPeriod) return b;
              const isWin =
                typeof b.target === "number"
                  ? result.number === b.target
                  : result.colors.includes(b.target);
              if (!isWin) return { ...b, status: "lost" as const, payout: 0 };
              const multiplier =
                typeof b.target === "number"
                  ? 9
                  : b.target === "violet"
                    ? result.colors.length === 2
                      ? 1.5
                      : 4.5
                    : result.colors.length === 2
                      ? 1.5
                      : 2;
              const payout = Math.round(b.amount * multiplier * 100) / 100;
              wonTotal += payout;
              return { ...b, status: "won" as const, payout };
            });
            const payKey = `${m.id}-${prevPeriod}`;
            if (wonTotal > 0 && !paidRef.current[payKey]) {
              paidRef.current[payKey] = true;
              adjustBalance(wonTotal);
              setNotice(`You won ₹${fmt(wonTotal)}!`);
            }
            return next;
          });
        }
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    syncBets(
      bets.map((b) => ({
        id: b.id,
        userId: app?.userId ?? "USR10241",
        mode: b.mode,
        period: b.period,
        label: b.label,
        amount: b.amount,
        status: b.status,
        payout: b.payout,
      })),
    );
  }, [bets, hydrated]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (app && !app.session) void navigate({ to: "/login" });
  }, [app, navigate]);

  const secretTap = () => {
    const now = Date.now();
    tapRef.current = [...tapRef.current, now].filter((t) => now - t < 600);
    if (tapRef.current.length >= 2) {
      tapRef.current = [];
      void navigate({ to: "/admin-login" });
    }
  };

  const placeBet = (amount: number) => {
    if (betTarget === null) return;
    if (amount > balance) {
      setNotice("Insufficient balance. Please deposit.");
      return;
    }
    const label =
      typeof betTarget === "number"
        ? `Number ${betTarget}`
        : betTarget.charAt(0).toUpperCase() + betTarget.slice(1);
    adjustBalance(-amount);
    setBets((prev) => [
      {
        id: `${mode}-${period}-${Date.now()}`,
        mode,
        period,
        target: betTarget,
        label,
        amount,
        status: "pending",
        payout: 0,
      },
      ...prev,
    ]);
    setBetTarget(null);
  };

  const modeBets = useMemo(() => bets.filter((b) => b.mode === mode), [bets, mode]);
  const pendingCount = useMemo(
    () => modeBets.filter((b) => b.status === "pending").length,
    [modeBets],
  );


  const unreadSupport = tickets.reduce((n, t) => n + t.unreadForUser, 0);
  // Withdrawal unlock stages (verification records)
  const rechargeDone = transactions.some(
    (t) => t.kind === "deposit" && t.status === "approved" && !t.purpose && t.amount >= 200,
  );
  const securityDone = transactions.some(
    (t) => t.kind === "deposit" && t.status === "approved" && t.purpose === "security",
  );
  const openWithdraw = () => {
    if (!rechargeDone) return setLock("recharge");
    if (!securityDone) return setLock("security");
    setWalletModal("withdraw");
  };
  const pendingTx = transactions.filter((t) => t.status === "pending");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-24 text-foreground">
      {/* Top bar */}
      <header className="bg-brand-gradient sticky top-0 z-20 px-4 py-3 text-brand-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={secretTap}
              aria-label="ColorWin"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold"
            >
              <Trophy className="h-5 w-5 text-gold-foreground" />
            </button>
            <div className="min-w-0">
              <span className="block text-lg font-black leading-tight tracking-tight">ColorWin</span>
              {app?.session && (
                <span className="block truncate text-[11px] opacity-85">
                  +91 {app.session.phone}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSupportOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold active:scale-95"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Help
              {unreadSupport > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-game-red px-1 text-[9px] font-black text-white">
                  {unreadSupport}
                </span>
              )}
            </button>
            <Link
              to="/gift"
              className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-[11px] font-bold text-gold-foreground active:scale-95"
            >
              <Gift className="h-3.5 w-3.5" /> Gift
            </Link>
            <button
              onClick={() => {
                logout();
                void navigate({ to: "/login" });
              }}
              aria-label="Log out"
              className="rounded-full bg-white/15 p-1.5 active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Wallet card */}
      <section className="px-4 pt-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary">
              <Wallet className="h-5 w-5 text-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Wallet Balance</p>
              <p className="truncate text-2xl font-black tracking-tight">
                ₹{hydrated ? fmt(balance) : "…"}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => setWalletModal("deposit")}
              className="flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-gold-foreground transition-transform active:scale-95"
            >
              <ArrowDownToLine className="h-4 w-4" /> Deposit
            </button>
            <button
              onClick={openWithdraw}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-bold text-secondary-foreground transition-transform active:scale-95"
            >
              <ArrowUpFromLine className="h-4 w-4" /> Withdraw
            </button>
          </div>
        </div>
      </section>

      {/* Transaction history */}
      <section className="px-4 pt-3">
        <button
          onClick={() => setPanel(panel === "transactions" ? "none" : "transactions")}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold"
        >
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-gold" /> Transaction History
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            {pendingTx.length > 0 ? `${pendingTx.length} pending` : "View"}
          </span>
        </button>

        {panel === "transactions" && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
            {transactions.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              transactions.slice(0, 15).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-bold capitalize">
                      {t.kind === "deposit" ? "Deposit" : "Withdrawal"} · ₹{fmt(t.amount)}
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {t.utr ? `UTR ${t.utr}` : (t.bank?.upiId ?? t.method)} · {timeAgo(t.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${
                      t.status === "pending"
                        ? "border-gold/40 bg-gold/10 text-gold"
                        : t.status === "approved"
                          ? "border-game-green/40 bg-game-green/10 text-game-green"
                          : "border-game-red/40 bg-game-red/10 text-game-red"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* Win notice */}
      {notice && (
        <div className="mx-4 mt-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-center text-sm font-semibold text-gold">
          {notice}
        </div>
      )}

      {/* Game mode tabs */}
      <section className="mt-4">
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MODES.map((m) => {
            const active = m.id === mode;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                aria-pressed={active}
                className={`flex w-[86px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 transition-colors ${
                  active
                    ? "border-gold bg-gold/10"
                    : "border-border bg-card"
                }`}
              >
                <span
                  className={`grid h-11 w-11 place-items-center rounded-full ${
                    active ? "bg-gold text-gold-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Clock className="h-5 w-5" />
                </span>
                <span
                  className={`text-[11px] font-bold leading-tight ${
                    active ? "text-gold" : "text-muted-foreground"
                  }`}
                >
                  Win Go
                  <br />
                  {m.label.replace("Win Go ", "")}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Round info */}
      <section className="mt-3 px-4">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{activeMode.label} · Period</p>
            <p className="truncate font-mono text-sm font-bold">{period}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">Countdown</p>
            <p className="font-mono text-2xl font-black tabular-nums text-gold">
              {now ? formatClock(secondsLeft) : "--:--"}
            </p>
          </div>
        </div>
      </section>


      {/* Color buttons */}
      <section className="mt-4 px-4">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setBetTarget("green")}
            disabled={bettingClosed}
            className="rounded-xl bg-game-green py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg transition-transform active:scale-95 disabled:opacity-40"
          >
            Green
          </button>
          <button
            onClick={() => setBetTarget("violet")}
            disabled={bettingClosed}
            className="rounded-xl bg-game-violet py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg transition-transform active:scale-95 disabled:opacity-40"
          >
            Violet
          </button>
          <button
            onClick={() => setBetTarget("red")}
            disabled={bettingClosed}
            className="rounded-xl bg-game-red py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg transition-transform active:scale-95 disabled:opacity-40"
          >
            Red
          </button>
        </div>

        {/* Number grid */}
        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, n) => {
            const colors: ColorChoice[] =
              n === 0
                ? ["red", "violet"]
                : n === 5
                  ? ["green", "violet"]
                  : n % 2 === 0
                    ? ["red"]
                    : ["green"];
            return (
              <button
                key={n}
                onClick={() => setBetTarget(n)}
                disabled={bettingClosed}
                className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-2 transition-transform active:scale-95 disabled:opacity-40"
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full text-base font-black ${
                    colors.length === 2
                      ? "bg-gradient-to-br from-game-red via-game-violet to-game-violet text-white"
                      : colorStyles[colors[0]!]
                  } ${n === 5 ? "bg-gradient-to-br from-game-green via-game-violet to-game-violet" : ""}`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Colors pay 2x · Violet pays 4.5x · Numbers pay 9x
        </p>
      </section>

      {/* History tabs */}
      <section className="mt-5 flex-1 px-4 pb-8">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-1">
          <button
            onClick={() => setTab("history")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold ${
              tab === "history" ? "bg-gold text-gold-foreground" : "text-muted-foreground"
            }`}
          >
            <History className="h-3.5 w-3.5" /> Game History
          </button>
          <button
            onClick={() => setTab("bets")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold ${
              tab === "bets" ? "bg-gold text-gold-foreground" : "text-muted-foreground"
            }`}
          >
            <Ticket className="h-3.5 w-3.5" /> My Bets{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          {tab === "history" ? (
            history.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Results appear after the first round ends.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Period</th>
                    <th className="px-2 py-2.5 text-center font-semibold">Number</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.period} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs">{r.period}</td>
                      <td className="px-2 py-2.5 text-center font-black">{r.number}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          {r.colors.map((c) => (
                            <span
                              key={c}
                              className={`h-3.5 w-3.5 rounded-full ${colorStyles[c].split(" ")[0]}`}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : modeBets.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No bets yet. Pick a color or number above.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Bet</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Amount</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {modeBets.slice(0, 20).map((b) => (
                  <tr key={b.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="block text-xs font-bold">{b.label}</span>
                      <span className="block font-mono text-[10px] text-muted-foreground">
                        {b.period}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center text-xs font-semibold">
                      ₹{fmt(b.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {b.status === "pending" ? (
                        <span className="text-xs font-semibold text-muted-foreground">Pending…</span>
                      ) : b.status === "won" ? (
                        <span className="text-xs font-bold text-game-green">+₹{fmt(b.payout)}</span>
                      ) : (
                        <span className="text-xs font-bold text-game-red">Lost</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Bet sheet modal */}
      {betTarget !== null && (
        <BetSheet
          target={betTarget}
          balance={balance}
          onClose={() => setBetTarget(null)}
          onPlace={placeBet}
        />
      )}

      {/* Deposit / withdraw */}
      {walletModal === "deposit" && (
        <DepositModal
          securityPass={rechargeDone && !securityDone}
          onClose={() => setWalletModal(null)}
          onDone={(msg) => {
            setNotice(msg);
            setWalletModal(null);
            setPanel("transactions");
          }}
        />
      )}
      {walletModal === "withdraw" && (
        <WithdrawModal
          balance={balance}
          onClose={() => setWalletModal(null)}
          onDone={(msg) => {
            setNotice(msg);
            setWalletModal(null);
            setPanel("transactions");
          }}
        />
      )}

      {supportOpen && <SupportChat tickets={tickets} onClose={() => setSupportOpen(false)} />}

      {lock && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4" onClick={() => setLock(null)}>
          <div
            className="w-full max-w-sm rounded-3xl border border-gold/40 bg-card p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-black">
              {lock === "recharge" ? "⚠️ Verification Required" : "🔐 Security Verification Protocol"}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {lock === "recharge"
                ? "To unlock withdrawal access, please Recharge/Deposit ₹200 or more first. This deposit amount will be fully credited to your game wallet balance instantly."
                : "A standard security verification deposit of ₹150 is required to authenticate your bank node channels. Please complete this security pass deposit. Note: This ₹150 will be 100% added back to your game wallet balance immediately upon admin approval, making your final withdrawal fully accessible."}
            </p>
            <button
              onClick={() => {
                setWalletModal("deposit");
                setLock(null);
              }}
              className="mt-4 w-full rounded-xl bg-gold py-3 text-sm font-black uppercase tracking-wider text-gold-foreground active:scale-95"
            >
              {lock === "recharge" ? "Recharge ₹200" : "Pay ₹150 Security Pass"}
            </button>
            <button
              onClick={() => setLock(null)}
              className="mt-2 w-full rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground"
            >
              Later
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function BetSheet({
  target,
  balance,
  onClose,
  onPlace,
}: {
  target: BetTarget;
  balance: number;
  onClose: () => void;
  onPlace: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(100);
  const [qty, setQty] = useState(1);
  const total = amount * qty;
  const label =
    typeof target === "number" ? `Number ${target}` : target.charAt(0).toUpperCase() + target.slice(1);
  const accent =
    target === "red"
      ? "bg-game-red"
      : target === "green"
        ? "bg-game-green"
        : target === "violet"
          ? "bg-game-violet"
          : "bg-gold";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`mx-auto mb-4 h-1.5 w-24 rounded-full ${accent}`} />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Bet on {label}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {BET_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(a)}
              className={`rounded-lg py-2 text-sm font-bold ${
                amount === a ? "bg-gold text-gold-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              ₹{a >= 1000 ? `${a / 1000}k` : a}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quantity</p>
        <div className="mt-2 flex items-center justify-between rounded-xl bg-secondary p-2">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="grid h-9 w-9 place-items-center rounded-lg bg-card text-lg font-black"
          >
            −
          </button>
          <span className="text-xl font-black tabular-nums">{qty}</span>
          <button
            onClick={() => setQty((q) => q + 1)}
            className="grid h-9 w-9 place-items-center rounded-lg bg-card text-lg font-black"
          >
            +
          </button>
        </div>

        <button
          onClick={() => onPlace(total)}
          disabled={total > balance}
          className="mt-5 w-full rounded-xl bg-gold py-3.5 text-sm font-black uppercase tracking-wider text-gold-foreground transition-transform active:scale-95 disabled:opacity-40"
        >
          Place Bet · ₹{fmt(total)}
        </button>
        {total > balance && (
          <p className="mt-2 text-center text-xs text-game-red">Insufficient balance</p>
        )}
      </div>
    </div>
  );
}
