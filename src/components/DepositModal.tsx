import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import qrAsset from "@/assets/navi-upi-qr.jpg.asset.json";
import { money, requestDeposit } from "@/lib/mock-store";

const UPI_ID = "9608890478-2@nyes";
const PRESETS = [100, 500, 1000, 5000];

export function DepositModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [amount, setAmount] = useState(500);
  const [utr, setUtr] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed — please copy the UPI ID manually.");
    }
  };

  const submit = () => {
    const clean = utr.replace(/\s/g, "");
    if (!Number.isFinite(amount) || amount < 100) {
      setError("Minimum deposit is ₹100.");
      return;
    }
    if (!/^\d{12}$/.test(clean)) {
      setError("Enter the 12-digit UTR / Transaction ID from your UPI app.");
      return;
    }
    requestDeposit(amount, "Navi UPI", clean);
    onDone(`Deposit request of ₹${money(amount)} submitted — status: Pending.`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-6" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Deposit via UPI</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl bg-white p-3">
          <img src={qrAsset.url} alt="Navi UPI QR code for ColorWin deposits" className="mx-auto w-full max-w-[260px]" />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">UPI ID</p>
            <p className="truncate font-mono text-sm font-bold">{UPI_ID}</p>
          </div>
          <button
            onClick={copy}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-xs font-black text-gold-foreground active:scale-95"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount paid</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              className={`rounded-lg py-2 text-sm font-bold ${
                amount === p ? "bg-gold text-gold-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              ₹{p >= 1000 ? `${p / 1000}k` : p}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={100}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-center text-lg font-black tabular-nums outline-none focus:ring-2 focus:ring-ring"
        />

        <label htmlFor="utr" className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Enter 12-Digit UTR / Transaction ID
        </label>
        <input
          id="utr"
          inputMode="numeric"
          maxLength={12}
          value={utr}
          onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
          placeholder="e.g. 302199481723"
          className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-center font-mono text-base tracking-widest outline-none focus:ring-2 focus:ring-ring"
        />

        {error && <p className="mt-2 text-center text-xs font-semibold text-game-red">{error}</p>}

        <button
          onClick={submit}
          className="mt-4 w-full rounded-xl bg-gold py-3.5 text-sm font-black uppercase tracking-wider text-gold-foreground active:scale-95"
        >
          Submit Deposit Request
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Funds are credited only after the admin verifies your UTR.
        </p>
      </div>
    </div>
  );
}
