import { useState } from "react";
import { X } from "lucide-react";
import { money, requestWithdraw, type BankDetails } from "@/lib/mock-store";

export function WithdrawModal({
  balance,
  onClose,
  onDone,
}: {
  balance: number;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [form, setForm] = useState<BankDetails>({
    bankName: "",
    accountNumber: "",
    ifsc: "",
    upiId: "",
  });
  const [amount, setAmount] = useState(500);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof BankDetails) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value.slice(0, 60) }));

  const submit = () => {
    const bank: BankDetails = {
      bankName: form.bankName.trim(),
      accountNumber: form.accountNumber.trim(),
      ifsc: form.ifsc.trim().toUpperCase(),
      upiId: form.upiId.trim(),
    };
    if (bank.bankName.length < 2) return setError("Enter your bank name.");
    if (!/^\d{9,18}$/.test(bank.accountNumber)) return setError("Account number must be 9–18 digits.");
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifsc)) return setError("Enter a valid IFSC code (e.g. HDFC0001234).");
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(bank.upiId)) return setError("Enter a valid UPI ID.");
    if (!Number.isFinite(amount) || amount < 200) return setError("Minimum withdrawal is ₹200.");
    if (amount > balance) return setError("Amount exceeds your wallet balance.");

    requestWithdraw(amount, bank);
    onDone(`Withdrawal request of ₹${money(amount)} submitted — status: Pending.`);
  };

  const field = "mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";
  const lbl = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-6" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Withdraw funds</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Available: ₹{money(balance)}</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className={lbl} htmlFor="bankName">Bank Name</label>
            <input id="bankName" value={form.bankName} onChange={set("bankName")} placeholder="HDFC Bank" className={field} />
          </div>
          <div>
            <label className={lbl} htmlFor="acc">Account Number</label>
            <input id="acc" inputMode="numeric" value={form.accountNumber} onChange={set("accountNumber")} placeholder="50100234567890" className={field} />
          </div>
          <div>
            <label className={lbl} htmlFor="ifsc">IFSC Code</label>
            <input id="ifsc" value={form.ifsc} onChange={set("ifsc")} placeholder="HDFC0001234" className={`${field} uppercase`} />
          </div>
          <div>
            <label className={lbl} htmlFor="upi">UPI ID</label>
            <input id="upi" value={form.upiId} onChange={set("upiId")} placeholder="name@bank" className={field} />
          </div>
          <div>
            <label className={lbl} htmlFor="wamt">Amount</label>
            <input
              id="wamt"
              type="number"
              min={200}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              className={`${field} text-center text-lg font-black tabular-nums`}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-center text-xs font-semibold text-game-red">{error}</p>}

        <button
          onClick={submit}
          className="mt-4 w-full rounded-xl bg-gold py-3.5 text-sm font-black uppercase tracking-wider text-gold-foreground active:scale-95"
        >
          Submit Withdrawal Request
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Amount is locked until the admin marks the payout as paid.
        </p>
      </div>
    </div>
  );
}
