// Mock in-browser backend for the ColorWin demo.
// Shared between the player app (/) and the admin panel (/admin) via
// localStorage + a custom event, so both loops can be tested live.

import { useEffect, useState } from "react";

export type TxKind = "deposit" | "withdraw";
export type TxStatus = "pending" | "approved" | "rejected";

export interface Transaction {
  id: string;
  kind: TxKind;
  amount: number;
  method: string;
  utr?: string | undefined;
  status: TxStatus;
  createdAt: number;
  resolvedAt?: number | undefined;
  adminNote?: string | undefined;
}

export interface TicketMessage {
  id: string;
  from: "user" | "admin";
  text: string;
  at: number;
}

export interface Ticket {
  id: string;
  subject: string;
  status: "open" | "closed";
  createdAt: number;
  updatedAt: number;
  unreadForAdmin: number;
  unreadForUser: number;
  messages: TicketMessage[];
}

export interface AppState {
  balance: number;
  transactions: Transaction[];
  tickets: Ticket[];
}

const KEY = "colorwin-app-state";
const EVENT = "colorwin-state-change";

function seed(): AppState {
  const now = Date.now();
  return {
    balance: 1000,
    transactions: [
      {
        id: "tx-seed-1",
        kind: "deposit",
        amount: 500,
        method: "UPI",
        utr: "302199481723",
        status: "approved",
        createdAt: now - 1000 * 60 * 60 * 5,
        resolvedAt: now - 1000 * 60 * 60 * 4,
      },
      {
        id: "tx-seed-2",
        kind: "withdraw",
        amount: 300,
        method: "Bank Card",
        status: "pending",
        createdAt: now - 1000 * 60 * 25,
      },
    ],
    tickets: [
      {
        id: "tk-seed-1",
        subject: "Deposit not credited",
        status: "open",
        createdAt: now - 1000 * 60 * 90,
        updatedAt: now - 1000 * 60 * 88,
        unreadForAdmin: 1,
        unreadForUser: 0,
        messages: [
          {
            id: "m1",
            from: "user",
            text: "I paid ₹500 by UPI but my balance did not update. UTR 302199481723.",
            at: now - 1000 * 60 * 90,
          },
        ],
      },
    ],
  };
}

let memory: AppState | null = null;

export function readState(): AppState {
  if (typeof window === "undefined") return seed();
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(KEY);
    memory = raw ? (JSON.parse(raw) as AppState) : seed();
  } catch {
    memory = seed();
  }
  return memory!;
}

export function writeState(next: AppState) {
  memory = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function update(fn: (s: AppState) => AppState) {
  writeState(fn(readState()));
}

/** Subscribe to the mock backend. Returns null until hydrated (SSR-safe). */
export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(readState());
    const onChange = () => setState({ ...readState() });
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", () => {
      memory = null;
      onChange();
    });
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  return state;
}

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/* ---------------- player actions ---------------- */

export function adjustBalance(delta: number) {
  update((s) => ({ ...s, balance: Math.round((s.balance + delta) * 100) / 100 }));
}

export function requestDeposit(amount: number, method: string, utr?: string) {
  update((s) => ({
    ...s,
    transactions: [
      { id: uid("tx"), kind: "deposit", amount, method, utr, status: "pending", createdAt: Date.now() },
      ...s.transactions,
    ],
  }));
}

/** Withdrawals lock the funds immediately; a rejection refunds them. */
export function requestWithdraw(amount: number, method: string) {
  update((s) => ({
    ...s,
    balance: Math.round((s.balance - amount) * 100) / 100,
    transactions: [
      { id: uid("tx"), kind: "withdraw", amount, method, status: "pending", createdAt: Date.now() },
      ...s.transactions,
    ],
  }));
}

export function createTicket(subject: string, text: string) {
  const now = Date.now();
  update((s) => ({
    ...s,
    tickets: [
      {
        id: uid("tk"),
        subject,
        status: "open",
        createdAt: now,
        updatedAt: now,
        unreadForAdmin: 1,
        unreadForUser: 0,
        messages: [{ id: uid("m"), from: "user", text, at: now }],
      },
      ...s.tickets,
    ],
  }));
}

export function postMessage(ticketId: string, from: "user" | "admin", text: string) {
  const now = Date.now();
  update((s) => ({
    ...s,
    tickets: s.tickets.map((t) =>
      t.id !== ticketId
        ? t
        : {
            ...t,
            status: "open",
            updatedAt: now,
            unreadForAdmin: from === "user" ? t.unreadForAdmin + 1 : t.unreadForAdmin,
            unreadForUser: from === "admin" ? t.unreadForUser + 1 : t.unreadForUser,
            messages: [...t.messages, { id: uid("m"), from, text, at: now }],
          },
    ),
  }));
}

export function markTicketRead(ticketId: string, who: "user" | "admin") {
  update((s) => ({
    ...s,
    tickets: s.tickets.map((t) =>
      t.id !== ticketId
        ? t
        : who === "admin"
          ? { ...t, unreadForAdmin: 0 }
          : { ...t, unreadForUser: 0 },
    ),
  }));
}

/* ---------------- admin actions ---------------- */

export function resolveTransaction(id: string, status: "approved" | "rejected", adminNote?: string) {
  update((s) => {
    const tx = s.transactions.find((t) => t.id === id);
    if (!tx || tx.status !== "pending") return s;
    let balance = s.balance;
    if (tx.kind === "deposit" && status === "approved") balance += tx.amount;
    if (tx.kind === "withdraw" && status === "rejected") balance += tx.amount; // refund locked funds
    return {
      ...s,
      balance: Math.round(balance * 100) / 100,
      transactions: s.transactions.map((t) =>
        t.id === id ? { ...t, status, resolvedAt: Date.now(), adminNote } : t,
      ),
    };
  });
}

export function setTicketStatus(id: string, status: "open" | "closed") {
  update((s) => ({
    ...s,
    tickets: s.tickets.map((t) => (t.id === id ? { ...t, status, updatedAt: Date.now() } : t)),
  }));
}

export function resetState() {
  writeState(seed());
}

export function money(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
