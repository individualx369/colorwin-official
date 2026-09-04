import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import qrAsset from "@/assets/navi-upi-qr.jpg.asset.json";
import { money, requestDeposit } from "@/lib/store";

const UPI_ID = "9608890478-2@nyes";
const PRESETS = [100, 200, 500, 1000];

export function DepositModal({
  onClose,
  onDone,
  securityPass = false,
}: {
  onClose: () => void;
  onDone: (msg: string) => void;
  securityPass?: boolean;
}) {
  const [amount, setAmount] = useState(securityPass ? 150 : 500);
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

  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const clean = utr.replace(/\s/g, "");
    const min = securityPass ? 150 : 100;
    if (!Number.isFinite(amount) || amount < min) {
      setError(`Minimum deposit is ₹${min}.`);
      return;
    }
    if (!/^\d{12}$/.test(clean)) {
      setError("Enter the 12-digit UTR / Transaction ID from your UPI app.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await requestDeposit(amount, "Navi UPI", clean, securityPass ? "security" : undefined);
      if (!res.ok) {
        setBusy(false);
        setError(res.message);
        return;
      }
      onDone(`₹${money(amount)} credited to your wallet. ${res.message}`);
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-6" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">{securityPass ? "Security Pass Deposit" : "Deposit via UPI"}</h2>
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
              ₹{p}
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
          onClick={() => void submit()}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-gold py-3.5 text-sm font-black uppercase tracking-wider text-gold-foreground active:scale-95"
        >
          {busy ? "Verifying payment…" : "Submit Deposit Request"}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {securityPass
            ? "100% Secure System — this ₹150 security pass is credited back to your wallet the moment the gateway verifies it."
            : "Safe & Secure 🔐 — funds are credited automatically once the payment gateway verifies your UTR."}
        </p>
      </div>
    </div>
  );
}
