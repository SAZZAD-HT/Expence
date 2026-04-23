"use client";

import { decrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";
import {
  isPaymentDueSoon,
  nextBillingDate,
  interestFreePeriodEnd,
} from "@/lib/credit-card-math";
import { CreditCard, AlertTriangle } from "lucide-react";

interface Card {
  id: string;
  card_name_encrypted: string;
  credit_limit_encrypted: string;
  billing_cycle_day: number;
  interest_free_days: number;
  current_balance_encrypted: string;
  minimum_due_encrypted: string;
  existing_emi_count: number;
  existing_emi_amount_encrypted: string | null;
}

interface CreditCardPanelProps {
  card: Card;
  onDelete?: (id: string) => void;
}

import { formatTaka } from "@/lib/format";

export function CreditCardPanelItem({ card, onDelete }: CreditCardPanelProps) {
  const { sessionKey } = useSessionStore();

  if (!sessionKey) return null;

  function dec(c: string): string {
    try {
      return decrypt(c, sessionKey!);
    } catch {
      return c;
    }
  }

  const name = dec(card.card_name_encrypted);
  const limit = parseInt(dec(card.credit_limit_encrypted), 10) || 0;
  const balance = parseInt(dec(card.current_balance_encrypted), 10) || 0;
  const minDue = parseInt(dec(card.minimum_due_encrypted), 10) || 0;
  const emiAmount = card.existing_emi_amount_encrypted
    ? parseInt(dec(card.existing_emi_amount_encrypted), 10) || 0
    : 0;

  const available = Math.max(0, limit - balance);
  const usedPct = limit > 0 ? Math.min((balance / limit) * 100, 100) : 0;
  const nextDue = nextBillingDate(card.billing_cycle_day);
  const dueSoon = isPaymentDueSoon(nextDue);
  const intFreeEnd = interestFreePeriodEnd(
    new Date().toISOString().slice(0, 10),
    card.billing_cycle_day,
    card.interest_free_days
  );

  let barColor = "bg-[#34d399]";
  if (usedPct >= 90) barColor = "bg-[#f87171]";
  else if (usedPct >= 70) barColor = "bg-[#fbbf24]";

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 shadow-sm">
            <CreditCard className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{name}</h3>
            <p className="text-xs text-slate-400">
              Billing day {card.billing_cycle_day} · {card.interest_free_days}d
              interest-free
            </p>
          </div>
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(card.id)}
            className="text-xs text-slate-300 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/40 px-3 py-2">
          <p className="text-xs text-slate-400">Balance</p>
          <p className="text-sm font-semibold text-slate-800">
            {formatTaka(balance)}
          </p>
        </div>
        <div className="rounded-lg bg-white/40 px-3 py-2">
          <p className="text-xs text-slate-400">Available</p>
          <p className="text-sm font-semibold text-[#34d399]">
            {formatTaka(available)}
          </p>
        </div>
        <div className="rounded-lg bg-white/40 px-3 py-2">
          <p className="text-xs text-slate-400">Minimum Due</p>
          <p className="text-sm font-semibold text-slate-800">
            {formatTaka(minDue)}
          </p>
        </div>
        <div className="rounded-lg bg-white/40 px-3 py-2">
          <p className="text-xs text-slate-400">Next Due</p>
          <p
            className={`text-sm font-semibold ${dueSoon ? "text-[#f87171]" : "text-slate-800"}`}
          >
            {nextDue}
          </p>
        </div>
      </div>

      {/* Credit Utilization Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Credit used</span>
          <span>{usedPct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200/60 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </div>

      {dueSoon && (
        <div className="flex items-center gap-1.5 rounded-lg bg-red-50/60 px-3 py-2 text-xs text-[#f87171]">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Payment due soon — {nextDue}
        </div>
      )}

      <div className="text-xs text-slate-400">
        Interest-free until: <span className="text-slate-600">{intFreeEnd}</span>
      </div>

      {card.existing_emi_count > 0 && emiAmount > 0 && (
        <div className="text-xs text-slate-500">
          {card.existing_emi_count} active EMI(s) · {formatTaka(emiAmount)}/mo
        </div>
      )}
    </div>
  );
}

interface CreditCardListProps {
  cards: Card[];
  onDelete?: (id: string) => void;
}

export default function CreditCardPanel({ cards, onDelete }: CreditCardListProps) {
  if (cards.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        No credit cards added yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <CreditCardPanelItem key={card.id} card={card} onDelete={onDelete} />
      ))}
    </div>
  );
}
