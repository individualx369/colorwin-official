// Mock in-browser backend for the ColorWin demo.
// Shared between the player app (/) and the admin panel (/admin) via
// localStorage + a custom event, so both loops can be tested live.

import { useEffect, useState } from "react";

export type TxKind = "deposit" | "withdraw";
export type TxStatus = "pending" | "approved" | "rejected";

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
}

export interface Transaction {
  id: string;
  userId: string;
  kind: TxKind;
  amount: number;
  method: string;
  utr?: string | undefined;
  bank?: BankDetails | undefined;
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

export interface LiveBet {
  id: string;
  userId: string;
  mode: string;
  period: string;
  label: string;
  amount: number;
  status: "pending" | "won" | "lost";
  payout: number;
}

export interface Account {
  phone: string;
  password: string;
  userId: string;
  inviteCode?: string | undefined;
  createdAt: number;
}

export interface GiftClaim {
  userId: string;
  phone: string;
  at: number;
}

export interface GiftCode {
  code: string;
  amount: number;
  active: boolean;
  createdAt: number;
  claims: GiftClaim[];
}

export interface Redemption {
  id: string;
  userId: string;
  code: string;
  amount: number;
  at: number;
}

export interface AppState {
  userId: string;
  balance: number;
  transactions: Transaction[];
  tickets: Ticket[];
  bets: LiveBet[];
  accounts: Account[];
  session: { phone: string; userId: string } | null;
  giftCodes: GiftCode[];
  redemptions: Redemption[];
}

const KEY = "colorwin-app-state";
const EVENT = "colorwin-state-change";

function seed(): AppState {
  const now = Date.now();
  return {
    userId: "USR10241",
    balance: 1000,
    bets: [],
    transactions: [
      {
        id: "tx-seed-1",
        userId: "USR10241",
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
        userId: "USR10241",
        kind: "withdraw",
        amount: 300,
        method: "Bank Transfer",
        bank: {
          bankName: "HDFC Bank",
          accountNumber: "50100234567890",
          ifsc: "HDFC0001234",
          upiId: "9608890478-2@nyes",
        },
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
    accounts: [],
    session: null,
    giftCodes: [
      { code: "GIFT50", amount: 50, active: true, createdAt: now, claims: [] },
      { code: "WELCOME100", amount: 100, active: true, createdAt: now, claims: [] },
      { code: "BG678", amount: 678, active: true, createdAt: now, claims: [] },
    ],
    redemptions: [],
  };
}

let memory: AppState | null = null;

export function readState(): AppState {
  if (typeof window === "undefined") return seed();
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(KEY);
    const base = seed();
    memory = raw ? { ...base, ...(JSON.parse(raw) as AppState) } : base;
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
      {
        id: uid("tx"),
        userId: s.userId,
        kind: "deposit",
        amount,
        method,
        utr,
        status: "pending",
        createdAt: Date.now(),
      },
      ...s.transactions,
    ],
  }));
}

/** Withdrawals lock the funds immediately; a rejection refunds them. */
export function requestWithdraw(amount: number, bank: BankDetails) {
  update((s) => ({
    ...s,
    balance: Math.round((s.balance - amount) * 100) / 100,
    transactions: [
      {
        id: uid("tx"),
        userId: s.userId,
        kind: "withdraw",
        amount,
        method: "Bank Transfer",
        bank,
        status: "pending",
        createdAt: Date.now(),
      },
      ...s.transactions,
    ],
  }));
}

/** Mirror the player's live bets into the shared store for the admin monitor. */
export function syncBets(bets: LiveBet[]) {
  const current = readState();
  if (JSON.stringify(current.bets) === JSON.stringify(bets)) return;
  writeState({ ...current, bets });
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

/* ---------------- auth ---------------- */

const idFromPhone = (phone: string) => `USR${phone.replace(/\D/g, "").slice(-6)}`;

export function registerAccount(phone: string, password: string, inviteCode?: string) {
  const s = readState();
  if (s.accounts.some((a) => a.phone === phone)) {
    return { ok: false as const, error: "This phone number is already registered." };
  }
  const account: Account = {
    phone,
    password,
    userId: idFromPhone(phone),
    inviteCode,
    createdAt: Date.now(),
  };
  writeState({
    ...s,
    accounts: [account, ...s.accounts],
    session: { phone, userId: account.userId },
    userId: account.userId,
  });
  return { ok: true as const };
}

export function loginAccount(phone: string, password: string) {
  const s = readState();
  const account = s.accounts.find((a) => a.phone === phone);
  if (!account || account.password !== password) {
    return { ok: false as const, error: "Incorrect phone number or password." };
  }
  writeState({ ...s, session: { phone, userId: account.userId }, userId: account.userId });
  return { ok: true as const };
}

export function logout() {
  update((s) => ({ ...s, session: null }));
}

/* ---------------- gift codes ---------------- */

export function redeemGiftCode(code: string) {
  const s = readState();
  const normalized = code.trim().toUpperCase();
  const gift = s.giftCodes.find((g) => g.code === normalized);
  if (!gift || !gift.active) return { ok: false as const, error: "Invalid or expired gift code." };
  const userId = s.session?.userId ?? s.userId;
  if (gift.claims.some((c) => c.userId === userId)) {
    return { ok: false as const, error: "You have already claimed this gift code." };
  }
  const at = Date.now();
  writeState({
    ...s,
    balance: Math.round((s.balance + gift.amount) * 100) / 100,
    giftCodes: s.giftCodes.map((g) =>
      g.code === normalized
        ? { ...g, claims: [...g.claims, { userId, phone: s.session?.phone ?? "guest", at }] }
        : g,
    ),
    redemptions: [
      { id: uid("gr"), userId, code: normalized, amount: gift.amount, at },
      ...s.redemptions,
    ],
  });
  return { ok: true as const, amount: gift.amount };
}

export function createGiftCode(code: string, amount: number) {
  const s = readState();
  const normalized = code.trim().toUpperCase();
  if (!normalized || amount <= 0) return { ok: false as const, error: "Enter a code and amount." };
  if (s.giftCodes.some((g) => g.code === normalized)) {
    return { ok: false as const, error: "That code already exists." };
  }
  writeState({
    ...s,
    giftCodes: [
      { code: normalized, amount, active: true, createdAt: Date.now(), claims: [] },
      ...s.giftCodes,
    ],
  });
  return { ok: true as const };
}

export function toggleGiftCode(code: string) {
  update((s) => ({
    ...s,
    giftCodes: s.giftCodes.map((g) => (g.code === code ? { ...g, active: !g.active } : g)),
  }));
}
