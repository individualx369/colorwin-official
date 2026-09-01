import { useEffect, useRef, useState } from "react";
import { Send, X, LifeBuoy } from "lucide-react";
import { createTicket, ensureSupportAutoReply, markTicketRead, postMessage, SUPPORT_AUTO_REPLY, timeAgo, type Ticket } from "@/lib/mock-store";

export function SupportChat({ tickets, onClose }: { tickets: Ticket[]; onClose: () => void }) {
  const [activeId, setActiveId] = useState<string | null>(tickets[0]?.id ?? null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const active = tickets.find((t) => t.id === activeId) ?? null;

  // Opening support always surfaces the official Telegram support card.
  useEffect(() => {
    ensureSupportAutoReply();
  }, []);

  useEffect(() => {
    if (active && active.unreadForUser > 0) markTicketRead(active.id, "user");
  }, [active?.id, active?.unreadForUser]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [active?.messages.length]);

  const send = () => {
    const msg = text.trim().slice(0, 1000);
    if (!msg) return;
    if (active) {
      postMessage(active.id, "user", msg);
      postMessage(active.id, "admin", SUPPORT_AUTO_REPLY);
    } else {
      createTicket(subject.trim().slice(0, 80) || "General help", msg);
      ensureSupportAutoReply();
    }
    setText("");
    setSubject("");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-gold" />
          <span className="font-black">Customer Support</span>
        </div>
        <button onClick={onClose} aria-label="Close support" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setActiveId(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
            activeId === null ? "bg-gold text-gold-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          + New ticket
        </button>
        {tickets.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              activeId === t.id ? "bg-gold text-gold-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {t.subject}
            {t.unreadForUser > 0 ? ` (${t.unreadForUser})` : ""}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {active ? (
          active.messages.map((m) => (
            <div key={m.id} className={m.from === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[80%]">
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.from === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-card-foreground"
                  }`}
                >
                  {m.text}
                </div>
                <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                  {m.from === "user" ? "You" : "Support"} · {timeAgo(m.at)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="subj">
              Subject
            </label>
            <input
              id="subj"
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, 80))}
              placeholder="e.g. Deposit not credited"
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Describe your issue below — our team replies inside this chat.
            </p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          placeholder="Type your message…"
          className="max-h-32 flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={send}
          aria-label="Send message"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold text-gold-foreground active:scale-95"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
