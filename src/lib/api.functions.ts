import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUPPORT_AUTO_REPLY } from "@/lib/support";

/* ------------------------------------------------------------------ types */

export interface TxRow {
  id: string;
  profile_id: string;
  kind: "deposit" | "withdraw";
  amount: number;
  method: string;
  utr: string | null;
  bank: Record<string, string> | null;
  purpose: "security" | null;
  status: "pending" | "processing" | "approved" | "rejected";
  gateway_provider: string | null;
  gateway_ref: string | null;
  gateway_message: string | null;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface TicketRow {
  id: string;
  profile_id: string;
  subject: string;
  status: "open" | "closed";
  unread_for_admin: number;
  unread_for_user: number;
  created_at: string;
  updated_at: string;
  messages: { id: string; sender: "user" | "admin" | "system"; body: string; created_at: string }[];
}

export interface ProfileRow {
  id: string;
  phone: string;
  display_name: string;
  balance: number;
  created_at: string;
}

export interface Snapshot {
  profile: ProfileRow | null;
  isAdmin: boolean;
  profiles: ProfileRow[];
  transactions: TxRow[];
  tickets: TicketRow[];
  giftCodes: { code: string; amount: number; active: boolean; created_at: string }[];
  claims: { id: string; code: string; profile_id: string; amount: number; created_at: string }[];
}

/* --------------------------------------------------------------- helpers */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Ctx = { supabase: any; userId: string };

async function myProfile(context: Ctx) {
  const db = await admin();
  const { data } = await db
    .from("profiles")
    .select("*")
    .eq("auth_user_id", context.userId)
    .maybeSingle();
  return data as ProfileRow | null;
}

async function assertAdmin(context: Ctx) {
  const db = await admin();
  const { data } = await db
    .from("user_roles")
    .select("id")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden — administrator access required.");
}

/* ------------------------------------------------------------- profiles */

export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { phone: string; displayName?: string }) => ({
    phone: String(d.phone).replace(/\D/g, "").slice(-10),
    displayName: (d.displayName ?? "").slice(0, 60),
  }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const existing = await myProfile(context as Ctx);
    if (existing) return existing;

    const byPhone = await db.from("profiles").select("*").eq("phone", data.phone).maybeSingle();
    if (byPhone.data) {
      if (byPhone.data.auth_user_id && byPhone.data.auth_user_id !== context.userId) {
        throw new Error("This phone number belongs to another account.");
      }
      const { data: linked } = await db
        .from("profiles")
        .update({ auth_user_id: context.userId })
        .eq("id", byPhone.data.id)
        .select()
        .single();
      return linked as ProfileRow;
    }

    const { data: created, error } = await db
      .from("profiles")
      .insert({
        auth_user_id: context.userId,
        phone: data.phone,
        display_name: data.displayName || `Player ${data.phone.slice(-4)}`,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created as ProfileRow;
  });

export const fetchSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Snapshot> => {
    const db = await admin();
    const ctx = context as Ctx;
    const profile = await myProfile(ctx);

    const { data: roleRow } = await db
      .from("user_roles")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = Boolean(roleRow);

    let txQuery = db.from("transactions").select("*").order("created_at", { ascending: false }).limit(300);
    let ticketQuery = db.from("support_tickets").select("*").order("updated_at", { ascending: false }).limit(200);
    let claimQuery = db.from("gift_claims").select("*").order("created_at", { ascending: false }).limit(200);
    if (!isAdmin) {
      const pid = profile?.id ?? "00000000-0000-0000-0000-000000000000";
      txQuery = txQuery.eq("profile_id", pid);
      ticketQuery = ticketQuery.eq("profile_id", pid);
      claimQuery = claimQuery.eq("profile_id", pid);
    }

    const [txs, tickets, claims, gifts, profiles] = await Promise.all([
      txQuery,
      ticketQuery,
      claimQuery,
      db.from("gift_codes").select("*").order("created_at", { ascending: false }),
      isAdmin
        ? db.from("profiles").select("*").order("created_at", { ascending: false }).limit(200)
        : Promise.resolve({ data: profile ? [profile] : [] }),
    ]);

    const ticketRows = (tickets.data ?? []) as TicketRow[];
    let messages: any[] = [];
    if (ticketRows.length) {
      const { data } = await db
        .from("ticket_messages")
        .select("*")
        .in("ticket_id", ticketRows.map((t) => t.id))
        .order("created_at", { ascending: true });
      messages = data ?? [];
    }

    return {
      profile,
      isAdmin,
      profiles: (profiles.data ?? []) as ProfileRow[],
      transactions: (txs.data ?? []) as TxRow[],
      tickets: ticketRows.map((t) => ({ ...t, messages: messages.filter((m) => m.ticket_id === t.id) })),
      giftCodes: (gifts.data ?? []) as Snapshot["giftCodes"],
      claims: (claims.data ?? []) as Snapshot["claims"],
    };
  });

/* --------------------------------------------------------------- wallet */

export const adjustWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { delta: number }) => ({ delta: Number(d.delta) }))
  .handler(async ({ data, context }) => {
    if (!Number.isFinite(data.delta) || Math.abs(data.delta) > 500000) throw new Error("Invalid amount");
    const profile = await myProfile(context as Ctx);
    if (!profile) throw new Error("Profile missing");
    const next = Math.round((Number(profile.balance) + data.delta) * 100) / 100;
    if (next < 0) throw new Error("Insufficient balance");
    const db = await admin();
    const { error } = await db.from("profiles").update({ balance: next }).eq("id", profile.id);
    if (error) throw new Error(error.message);
    return { balance: next };
  });

/* ------------------------------------------------------------- payments */

export const submitDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amount: number; method: string; utr: string; purpose?: "security" }) => ({
    amount: Math.round(Number(d.amount) * 100) / 100,
    method: String(d.method).slice(0, 40),
    utr: String(d.utr).trim().toUpperCase().slice(0, 30),
    purpose: d.purpose === "security" ? ("security" as const) : undefined,
  }))
  .handler(async ({ data, context }) => {
    if (!(data.amount > 0)) throw new Error("Enter a valid amount.");
    const profile = await myProfile(context as Ctx);
    if (!profile) throw new Error("Profile missing");
    const db = await admin();

    const dupe = await db.from("transactions").select("id").eq("utr", data.utr).maybeSingle();
    if (dupe.data) throw new Error("This UTR has already been submitted.");

    const { data: tx, error } = await db
      .from("transactions")
      .insert({
        profile_id: profile.id,
        kind: "deposit",
        amount: data.amount,
        method: data.method,
        utr: data.utr,
        purpose: data.purpose ?? null,
        status: "processing",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { verifyUpiDeposit } = await import("@/lib/payments.server");
    const result = await verifyUpiDeposit(data.amount, data.utr);

    const { data: settled } = await db.rpc("settle_transaction", {
      _tx_id: tx.id,
      _status: result.ok ? "approved" : "rejected",
      _note: null,
      _provider: result.provider,
      _ref: result.ref ?? null,
      _message: result.message,
    });

    return { ok: result.ok, message: result.message, transaction: settled ?? tx };
  });

export const submitWithdraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amount: number; method: string; bank: Record<string, string> }) => ({
    amount: Math.round(Number(d.amount) * 100) / 100,
    method: String(d.method).slice(0, 60),
    bank: d.bank ?? {},
  }))
  .handler(async ({ data, context }) => {
    if (!(data.amount > 0)) throw new Error("Enter a valid amount.");
    const profile = await myProfile(context as Ctx);
    if (!profile) throw new Error("Profile missing");
    const db = await admin();

    const { data: tx, error } = await db.rpc("request_withdrawal", {
      _profile_id: profile.id,
      _amount: data.amount,
      _method: data.method,
      _bank: data.bank,
    });
    if (error) throw new Error(error.message);

    const { sendUpiPayout } = await import("@/lib/payments.server");
    const result = await sendUpiPayout(data.amount, data.bank);

    const { data: settled } = await db.rpc("settle_transaction", {
      _tx_id: tx.id,
      _status: result.ok ? "approved" : "rejected",
      _note: null,
      _provider: result.provider,
      _ref: result.ref ?? null,
      _message: result.message,
    });

    return { ok: result.ok, message: result.message, transaction: settled ?? tx };
  });

/* -------------------------------------------------------------- support */

export const openSupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await myProfile(context as Ctx);
    if (!profile) throw new Error("Profile missing");
    const db = await admin();
    const { data: existing } = await db
      .from("support_tickets")
      .select("*")
      .eq("profile_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    let ticket = existing?.[0];
    if (!ticket) {
      const created = await db
        .from("support_tickets")
        .insert({ profile_id: profile.id, subject: "Official Support" })
        .select()
        .single();
      ticket = created.data;
    }
    const { data: last } = await db
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!last?.[0] || last[0].body !== SUPPORT_AUTO_REPLY) {
      await db.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender: "system",
        body: SUPPORT_AUTO_REPLY,
      });
    }
    return { ticketId: ticket.id as string };
  });

export const sendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId?: string; subject?: string; text: string }) => ({
    ticketId: d.ticketId,
    subject: (d.subject ?? "").slice(0, 80),
    text: String(d.text).slice(0, 1000),
  }))
  .handler(async ({ data, context }) => {
    const profile = await myProfile(context as Ctx);
    if (!profile) throw new Error("Profile missing");
    if (!data.text.trim()) throw new Error("Message is empty.");
    const db = await admin();

    let ticketId = data.ticketId;
    if (ticketId) {
      const owned = await db.from("support_tickets").select("id").eq("id", ticketId).eq("profile_id", profile.id).maybeSingle();
      if (!owned.data) ticketId = undefined;
    }
    if (!ticketId) {
      const created = await db
        .from("support_tickets")
        .insert({ profile_id: profile.id, subject: data.subject || "General help" })
        .select()
        .single();
      ticketId = created.data.id as string;
    }

    await db.from("ticket_messages").insert({ ticket_id: ticketId, sender: "user", body: data.text });

    const { forwardToTelegram } = await import("@/lib/telegram.server");
    const messageId = await forwardToTelegram(
      `🎯 <b>ColorWin support</b>\nPlayer: ${profile.display_name} (+91 ${profile.phone})\nBalance: ₹${profile.balance}\n\n${data.text}`,
    );

    await db.from("support_tickets").update({
      status: "open",
      updated_at: new Date().toISOString(),
      unread_for_admin: 1,
      telegram_chat_id: process.env["TELEGRAM_SUPPORT_CHAT_ID"] ?? null,
    }).eq("id", ticketId);

    await db.from("ticket_messages").insert({
      ticket_id: ticketId,
      sender: "system",
      body: SUPPORT_AUTO_REPLY,
      telegram_message_id: messageId,
    });

    return { ticketId, forwarded: Boolean(messageId) };
  });

export const markTicketSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId: string; who: "user" | "admin" }) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    if (data.who === "admin") {
      await assertAdmin(context as Ctx);
      await db.from("support_tickets").update({ unread_for_admin: 0 }).eq("id", data.ticketId);
    } else {
      const profile = await myProfile(context as Ctx);
      if (!profile) throw new Error("Profile missing");
      await db
        .from("support_tickets")
        .update({ unread_for_user: 0 })
        .eq("id", data.ticketId)
        .eq("profile_id", profile.id);
    }
    return { ok: true };
  });

/* ----------------------------------------------------------- gift codes */

export const claimGift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => ({ code: String(d.code).trim().toUpperCase().slice(0, 30) }))
  .handler(async ({ data, context }) => {
    const profile = await myProfile(context as Ctx);
    if (!profile) throw new Error("Profile missing");
    const db = await admin();
    const { data: amount, error } = await db.rpc("claim_gift_code", {
      _profile_id: profile.id,
      _code: data.code,
    });
    if (error) throw new Error(error.message);
    return { amount: Number(amount) };
  });

/* ---------------------------------------------------------------- admin */

export const claimAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data: existing } = await db.from("user_roles").select("id").eq("role", "admin").limit(1);
    if (existing && existing.length > 0) {
      const mine = await db
        .from("user_roles")
        .select("id")
        .eq("user_id", (context as Ctx).userId)
        .eq("role", "admin")
        .maybeSingle();
      if (mine.data) return { ok: true, created: false };
      throw new Error("An administrator account already exists.");
    }
    const { error } = await db
      .from("user_roles")
      .insert({ user_id: (context as Ctx).userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true, created: true };
  });

export const adminSettle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { txId: string; status: "approved" | "rejected"; note?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const db = await admin();
    const { error } = await db.rpc("settle_transaction", {
      _tx_id: data.txId,
      _status: data.status,
      _note: data.note ?? "Manual staff override",
      _provider: null,
      _ref: null,
      _message: null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId: string; text: string }) => ({
    ticketId: d.ticketId,
    text: String(d.text).slice(0, 1000),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const db = await admin();
    await db.from("ticket_messages").insert({ ticket_id: data.ticketId, sender: "admin", body: data.text });
    await db
      .from("support_tickets")
      .update({ unread_for_user: 1, status: "open", updated_at: new Date().toISOString() })
      .eq("id", data.ticketId);
    const { forwardToTelegram } = await import("@/lib/telegram.server");
    await forwardToTelegram(`💬 <b>Support reply sent</b>\n${data.text}`);
    return { ok: true };
  });

export const adminSetTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId: string; status: "open" | "closed" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const db = await admin();
    await db
      .from("support_tickets")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.ticketId);
    return { ok: true };
  });

export const adminGift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { action: "create" | "toggle"; code: string; amount?: number }) => ({
    action: d.action,
    code: String(d.code).trim().toUpperCase().slice(0, 30),
    amount: Number(d.amount ?? 0),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const db = await admin();
    if (data.action === "create") {
      if (!data.code || !(data.amount > 0)) throw new Error("Enter a code and amount.");
      const { error } = await db.from("gift_codes").insert({ code: data.code, amount: data.amount });
      if (error) throw new Error("That code already exists.");
      return { ok: true };
    }
    const { data: row } = await db.from("gift_codes").select("active").eq("code", data.code).maybeSingle();
    if (!row) throw new Error("Code not found.");
    await db.from("gift_codes").update({ active: !row.active }).eq("code", data.code);
    return { ok: true };
  });
