// Live application store backed by the Lovable Cloud database.
// Wallet balances, transactions, support tickets and gift codes all come from
// the server; every mutation goes through a protected server function so
// balances can never be edited from the browser.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  adjustWallet,
  adminGift,
  adminReply,
  adminSetTicketStatus,
  adminSettle,
  claimGift,
  ensureProfile,
  fetchSnapshot,
  markTicketSeen,
  openSupport,
  sendSupportMessage,
  submitDeposit,
  submitWithdraw,
} from "@/lib/api.functions";

export { SUPPORT_AUTO_REPLY, TELEGRAM_SUPPORT_HANDLE, TELEGRAM_SUPPORT_URL } from "@/lib/support";

/* ----------------------------------------------------------------- types */

export type TxKind = "deposit" | "withdraw";
export type TxStatus = "pending" | "processing" | "approved" | "rejected";

export interface BankDetails {
  holderName?: string | undefined;
  bankName?: string | undefined;
  accountNumber?: string | undefined;
  ifsc?: string | undefined;
  upiId?: string | undefined;
}

export interface Transaction {
  id: string;
  userId: string;
  userLabel: string;
  kind: TxKind;
  amount: number;
  method: string;
  utr?: string | undefined;
  bank?: BankDetails | undefined;
  purpose?: "security" | undefined;
  status: TxStatus;
  createdAt: number;
  resolvedAt?: number | undefined;
  adminNote?: string | undefined;
  gatewayMessage?: string | undefined;
  gatewayRef?: string | undefined;
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
  userLabel: string;
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
  userId: string;
  displayName: string;
  balance: number;
  createdAt: number;
}

export interface GiftCode {
  code: string;
  amount: number;
  active: boolean;
  createdAt: number;
  claims: { userId: string; phone: string; at: number }[];
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
  isAdmin: boolean;
  transactions: Transaction[];
  tickets: Ticket[];
  bets: LiveBet[];
  accounts: Account[];
  session: { phone: string; userId: string; displayName: string } | null;
  giftCodes: GiftCode[];
  redemptions: Redemption[];
}

/* ------------------------------------------------------------- internals */

const EVENT = "colorwin-refresh";
const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

let localBets: LiveBet[] = [];
let cache: AppState | null = null;

export const emailForPhone = (phone: string) => `p${phone.replace(/\D/g, "").slice(-10)}@colorwin.app`;

export function refresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
}

function emptyState(): AppState {
  return {
    userId: "",
    balance: 0,
    isAdmin: false,
    transactions: [],
    tickets: [],
    bets: [],
    accounts: [],
    session: null,
    giftCodes: [],
    redemptions: [],
  };
}

async function loadState(): Promise<AppState> {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return emptyState();

  const snap = await fetchSnapshot();
  const label = (id: string) => {
    const p = snap.profiles.find((x) => x.id === id);
    return p ? `${p.display_name} · +91 ${p.phone}` : "Player";
  };

  return {
    userId: snap.profile?.id ?? "",
    balance: Number(snap.profile?.balance ?? 0),
    isAdmin: snap.isAdmin,
    bets: localBets,
    session: snap.profile
      ? { phone: snap.profile.phone, userId: snap.profile.id, displayName: snap.profile.display_name }
      : null,
    accounts: snap.profiles.map((p) => ({
      phone: p.phone,
      userId: p.id,
      displayName: p.display_name,
      balance: Number(p.balance),
      createdAt: ms(p.created_at),
    })),
    transactions: snap.transactions.map((t) => ({
      id: t.id,
      userId: t.profile_id,
      userLabel: label(t.profile_id),
      kind: t.kind,
      amount: Number(t.amount),
      method: t.method,
      utr: t.utr ?? undefined,
      bank: (t.bank as BankDetails | null) ?? undefined,
      purpose: t.purpose ?? undefined,
      status: t.status,
      createdAt: ms(t.created_at),
      resolvedAt: t.resolved_at ? ms(t.resolved_at) : undefined,
      adminNote: t.admin_note ?? undefined,
      gatewayMessage: t.gateway_message ?? undefined,
      gatewayRef: t.gateway_ref ?? undefined,
    })),
    tickets: snap.tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      userLabel: label(t.profile_id),
      status: t.status,
      createdAt: ms(t.created_at),
      updatedAt: ms(t.updated_at),
      unreadForAdmin: t.unread_for_admin,
      unreadForUser: t.unread_for_user,
      messages: t.messages.map((m) => ({
        id: m.id,
        from: m.sender === "user" ? ("user" as const) : ("admin" as const),
        text: m.body,
        at: ms(m.created_at),
      })),
    })),
    giftCodes: snap.giftCodes.map((g) => ({
      code: g.code,
      amount: Number(g.amount),
      active: g.active,
      createdAt: ms(g.created_at),
      claims: snap.claims
        .filter((c) => c.code === g.code)
        .map((c) => ({
          userId: c.profile_id,
          phone: snap.profiles.find((p) => p.id === c.profile_id)?.phone ?? "player",
          at: ms(c.created_at),
        })),
    })),
    redemptions: snap.claims.map((c) => ({
      id: c.id,
      userId: c.profile_id,
      code: c.code,
      amount: Number(c.amount),
      at: ms(c.created_at),
    })),
  };
}

/** Subscribe to the live application state. Returns null until loaded. */
export function useAppState() {
  const [state, setState] = useState<AppState | null>(cache);

  const reload = useCallback(async () => {
    try {
      const next = await loadState();
      cache = next;
      setState(next);
    } catch (error) {
      console.error("state load failed", error);
      setState((prev) => prev ?? emptyState());
    }
  }, []);

  useEffect(() => {
    void reload();
    const onEvent = () => void reload();
    window.addEventListener(EVENT, onEvent);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void reload();
    });
    const poll = setInterval(() => void reload(), 15000);
    return () => {
      window.removeEventListener(EVENT, onEvent);
      sub.subscription.unsubscribe();
      clearInterval(poll);
    };
  }, [reload]);

  return state;
}

/* --------------------------------------------------------- player actions */

export async function adjustBalance(delta: number) {
  try {
    await adjustWallet({ data: { delta } });
  } catch (error) {
    console.error("wallet update failed", error);
  }
  refresh();
}

export async function requestDeposit(
  amount: number,
  method: string,
  utr: string,
  purpose?: "security",
) {
  const res = await submitDeposit({ data: { amount, method, utr, ...(purpose ? { purpose } : {}) } });
  refresh();
  return res;
}

export async function requestWithdraw(amount: number, bank: BankDetails, method = "Bank Transfer") {
  const res = await submitWithdraw({
    data: { amount, method, bank: bank as Record<string, string> },
  });
  refresh();
  return res;
}

export function syncBets(bets: LiveBet[]) {
  localBets = bets;
  if (cache) cache.bets = bets;
}

export async function ensureSupportAutoReply() {
  try {
    await openSupport();
  } catch (error) {
    console.error("support init failed", error);
  }
  refresh();
}

export async function createTicket(subject: string, text: string) {
  await sendSupportMessage({ data: { subject, text } });
  refresh();
}

export async function postMessage(ticketId: string, from: "user" | "admin", text: string) {
  if (from === "admin") await adminReply({ data: { ticketId, text } });
  else await sendSupportMessage({ data: { ticketId, text } });
  refresh();
}

export async function markTicketRead(ticketId: string, who: "user" | "admin") {
  try {
    await markTicketSeen({ data: { ticketId, who } });
  } catch (error) {
    console.error(error);
  }
  refresh();
}

/* ---------------------------------------------------------- admin actions */

export async function resolveTransaction(
  id: string,
  status: "approved" | "rejected",
  adminNote?: string,
) {
  await adminSettle({ data: { txId: id, status, ...(adminNote ? { note: adminNote } : {}) } });
  refresh();
}

export async function setTicketStatus(id: string, status: "open" | "closed") {
  await adminSetTicketStatus({ data: { ticketId: id, status } });
  refresh();
}

/* --------------------------------------------------------------- helpers */

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

/* ------------------------------------------------------------------ auth */

export async function registerAccount(phone: string, password: string, displayName?: string) {
  const email = emailForPhone(phone);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { phone, display_name: displayName ?? "" } },
  });
  if (error) {
    return {
      ok: false as const,
      error: /already/i.test(error.message)
        ? "This phone number is already registered."
        : error.message,
    };
  }
  try {
    await ensureProfile({ data: { phone, ...(displayName ? { displayName } : {}) } });
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
  cache = null;
  refresh();
  return { ok: true as const };
}

export async function loginAccount(phone: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: emailForPhone(phone),
    password,
  });
  if (error) return { ok: false as const, error: "Incorrect phone number or password." };
  try {
    await ensureProfile({ data: { phone } });
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
  cache = null;
  refresh();
  return { ok: true as const };
}

export async function logout() {
  await supabase.auth.signOut();
  cache = null;
  localBets = [];
  refresh();
}

/* ------------------------------------------------------------ gift codes */

export async function redeemGiftCode(code: string) {
  try {
    const res = await claimGift({ data: { code } });
    refresh();
    return { ok: true as const, amount: res.amount };
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }
}

export async function createGiftCode(code: string, amount: number) {
  try {
    await adminGift({ data: { action: "create", code, amount } });
    refresh();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }
}

export async function toggleGiftCode(code: string) {
  try {
    await adminGift({ data: { action: "toggle", code } });
  } catch (error) {
    console.error(error);
  }
  refresh();
}
