import { useState } from "react";
import { X, Send, ShieldCheck } from "lucide-react";
import {
  money,
  timeAgo,
  postMessage,
  markTicketRead,
  resolveTransaction,
  setTicketStatus,
  type AppState,
} from "@/lib/mock-store";

type AdminTab = "deposits" | "withdrawals" | "bets" | "tickets";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "deposits", label: "Deposit Requests" },
  { id: "withdrawals", label: "Withdrawal Requests" },
  { id: "bets", label: "Live Bet Monitor" },
  { id: "tickets", label: "Support Tickets" },
];

export function AdminPanel({ state, onClose }: { state: AppState; onClose: () => void }) {
  const [tab, setTab] = useState<AdminTab>("deposits");

  const deposits = state.transactions.filter((t) => t.kind === "deposit");
  const withdrawals = state.transactions.filter((t) => t.kind === "withdraw");
  const pendingDeposits = deposits.filter((t) => t.status === "pending").length;
  const pendingWithdrawals = withdrawals.filter((t) => t.status === "pending").length;
  const unreadTickets = state.tickets.reduce((n, t) => n + t.unreadForAdmin, 0);

  const badge = (n: number) => (n > 0 ? ` (${n})` : "");

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-gold" />
          <span className="font-black">Admin Panel</span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            test mode
          </span>
        </div>
        <button onClick={onClose} aria-label="Close admin panel" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              tab === t.id ? "bg-gold text-gold-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {t.label}
            {t.id === "deposits" && badge(pendingDeposits)}
            {t.id === "withdrawals" && badge(pendingWithdrawals)}
            {t.id === "tickets" && badge(unreadTickets)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "deposits" && (
          <List empty="No deposit requests yet.">
            {deposits.map((t) => (
              <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">User {t.userId}</p>
                    <p className="text-xl font-black">₹{money(t.amount)}</p>
                    <p className="mt-1 font-mono text-xs">UTR: {t.utr ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.method} · {timeAgo(t.createdAt)}
                    </p>
                  </div>
                  <StatusPill status={t.status} />
                </div>
                {t.status === "pending" && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => resolveTransaction(t.id, "approved", "UTR verified")}
                      className="rounded-xl bg-game-green py-2.5 text-xs font-black uppercase tracking-wider text-white active:scale-95"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => resolveTransaction(t.id, "rejected", "UTR not found")}
                      className="rounded-xl bg-game-red py-2.5 text-xs font-black uppercase tracking-wider text-white active:scale-95"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </List>
        )}

        {tab === "withdrawals" && (
          <List empty="No withdrawal requests yet.">
            {withdrawals.map((t) => (
              <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">User {t.userId}</p>
                    <p className="text-xl font-black">₹{money(t.amount)}</p>
                  </div>
                  <StatusPill status={t.status} />
                </div>
                <dl className="mt-3 space-y-1 text-xs">
                  <Row label="Bank" value={t.bank?.bankName ?? "—"} />
                  <Row label="Account" value={t.bank?.accountNumber ?? "—"} />
                  <Row label="IFSC" value={t.bank?.ifsc ?? "—"} />
                  <Row label="UPI ID" value={t.bank?.upiId ?? "—"} />
                  <Row label="Requested" value={timeAgo(t.createdAt)} />
                </dl>
                {t.status === "pending" && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => resolveTransaction(t.id, "approved", "Paid manually")}
                      className="rounded-xl bg-game-green py-2.5 text-xs font-black uppercase tracking-wider text-white active:scale-95"
                    >
                      Approve / Paid
                    </button>
                    <button
                      onClick={() => resolveTransaction(t.id, "rejected", "Refunded to wallet")}
                      className="rounded-xl bg-game-red py-2.5 text-xs font-black uppercase tracking-wider text-white active:scale-95"
                    >
                      Reject &amp; Refund
                    </button>
                  </div>
                )}
              </div>
            ))}
          </List>
        )}

        {tab === "bets" && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {state.bets.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No bets placed yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2.5 text-left font-semibold">User / Mode</th>
                    <th className="px-2 py-2.5 text-left font-semibold">Bet</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.bets.slice(0, 50).map((b) => (
                    <tr key={b.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2.5">
                        <span className="block font-mono text-[11px]">{b.userId}</span>
                        <span className="block text-[11px] font-bold text-gold">Win Go {b.mode}</span>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="block text-xs font-bold">{b.label}</span>
                        <span className="block font-mono text-[10px] text-muted-foreground">{b.period}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold">₹{money(b.amount)}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold">
                        {b.status === "pending" ? (
                          <span className="text-muted-foreground">Active</span>
                        ) : b.status === "won" ? (
                          <span className="text-game-green">+₹{money(b.payout)}</span>
                        ) : (
                          <span className="text-game-red">Lost</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "tickets" && (
          <List empty="No support tickets yet.">
            {state.tickets.map((t) => (
              <AdminTicket key={t.id} ticket={t} />
            ))}
          </List>
        )}
      </div>
    </div>
  );
}

function AdminTicket({ ticket }: { ticket: AppState["tickets"][number] }) {
  const [reply, setReply] = useState("");

  const send = () => {
    const msg = reply.trim().slice(0, 1000);
    if (!msg) return;
    postMessage(ticket.id, "admin", msg);
    setReply("");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold">{ticket.subject}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {ticket.id} · updated {timeAgo(ticket.updatedAt)}
          </p>
        </div>
        <button
          onClick={() => setTicketStatus(ticket.id, ticket.status === "open" ? "closed" : "open")}
          className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[10px] font-bold uppercase text-muted-foreground"
        >
          {ticket.status}
        </button>
      </div>

      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl bg-secondary/50 p-2">
        {ticket.messages.map((m) => (
          <div key={m.id} className={m.from === "admin" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                m.from === "admin" ? "bg-primary text-primary-foreground" : "border border-border bg-card"
              }`}
            >
              <p>{m.text}</p>
              <p className="mt-1 text-[9px] opacity-70">
                {m.from === "admin" ? "Admin" : "User"} · {timeAgo(m.at)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          rows={1}
          value={reply}
          onFocus={() => ticket.unreadForAdmin > 0 && markTicketRead(ticket.id, "admin")}
          onChange={(e) => setReply(e.target.value.slice(0, 1000))}
          placeholder="Type a reply to this user…"
          className="max-h-28 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={send}
          aria-label="Send reply"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold text-gold-foreground active:scale-95"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function List({ children, empty }: { children: React.ReactNode; empty: string }) {
  const items = Array.isArray(children) ? children : [children];
  if (items.flat().filter(Boolean).length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return <div className="space-y-3">{children}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono">{value}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "approved" | "rejected" }) {
  const cls =
    status === "pending"
      ? "border-gold/40 bg-gold/10 text-gold"
      : status === "approved"
        ? "border-game-green/40 bg-game-green/10 text-game-green"
        : "border-game-red/40 bg-game-red/10 text-game-red";
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${cls}`}>
      {status}
    </span>
  );
}
