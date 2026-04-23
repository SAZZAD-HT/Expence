"use client";

import { decrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";
import {
  calculateEMI,
  totalInterest,
  monthsRemaining,
  daysRemaining,
} from "@/lib/loan-math";
import { Landmark, TrendingDown } from "lucide-react";

interface Loan {
  id: string;
  loan_name_encrypted: string; // layer-2 ciphertext
  principal_encrypted: string;
  interest_rate_encrypted: string;
  start_date: string;
  tenure_months: number;
  emi_amount_encrypted: string;
  segment_id: string | null;
}

interface LoanCardProps {
  loan: Loan;
  monthlySalaryPaise: number;
  onDelete?: (id: string) => void;
}

import { formatTaka } from "@/lib/format";

function LoanCard({ loan, monthlySalaryPaise, onDelete }: LoanCardProps) {
  const { sessionKey } = useSessionStore();

  if (!sessionKey) return null;

  function dec(c: string): string {
    try {
      return decrypt(c, sessionKey!);
    } catch {
      return c;
    }
  }

  const name = dec(loan.loan_name_encrypted);
  const principal = parseInt(dec(loan.principal_encrypted), 10) || 0;
  const rate = parseFloat(dec(loan.interest_rate_encrypted)) || 0;
  const emi = parseInt(dec(loan.emi_amount_encrypted), 10) || 0;
  const monthsLeft = monthsRemaining(loan.start_date, loan.tenure_months);
  const daysLeft = daysRemaining(loan.start_date, loan.tenure_months);
  const totalInt = totalInterest(principal, rate, loan.tenure_months);
  const recalcEmi = calculateEMI(principal, rate, loan.tenure_months);
  const salaryPct =
    monthlySalaryPaise > 0
      ? ((emi / monthlySalaryPaise) * 100).toFixed(1)
      : null;

  const progress =
    loan.tenure_months > 0
      ? Math.max(0, ((loan.tenure_months - monthsLeft) / loan.tenure_months) * 100)
      : 0;

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 shadow-sm">
            <Landmark className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{name}</h3>
            <p className="text-xs text-slate-400">
              {rate}% p.a. · {loan.tenure_months}m tenure
            </p>
          </div>
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(loan.id)}
            className="text-xs text-slate-300 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/40 px-3 py-2">
          <p className="text-xs text-slate-400">EMI</p>
          <p className="text-sm font-semibold text-slate-800">
            {formatTaka(emi || recalcEmi)}
          </p>
        </div>
        <div className="rounded-lg bg-white/40 px-3 py-2">
          <p className="text-xs text-slate-400">Principal</p>
          <p className="text-sm font-semibold text-slate-800">
            {formatTaka(principal)}
          </p>
        </div>
        <div className="rounded-lg bg-white/40 px-3 py-2">
          <p className="text-xs text-slate-400">Total Interest</p>
          <p className="text-sm font-semibold text-slate-800">
            {formatTaka(totalInt)}
          </p>
        </div>
        <div className="rounded-lg bg-white/40 px-3 py-2">
          <p className="text-xs text-slate-400">Months Left</p>
          <p className="text-sm font-semibold text-slate-800">
            {monthsLeft}{" "}
            <span className="text-xs font-normal text-slate-400">
              ({daysLeft}d)
            </span>
          </p>
        </div>
      </div>

      {salaryPct !== null && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <TrendingDown className="h-3 w-3" />
          {salaryPct}% of monthly salary
        </div>
      )}

      {/* Repayment progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Repayment progress</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#34d399] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface LoanCalculatorProps {
  loans: Loan[];
  monthlySalaryPaise: number;
  onDelete?: (id: string) => void;
}

export default function LoanCalculator({
  loans,
  monthlySalaryPaise,
  onDelete,
}: LoanCalculatorProps) {
  if (loans.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        No loans added yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {loans.map((loan) => (
        <LoanCard
          key={loan.id}
          loan={loan}
          monthlySalaryPaise={monthlySalaryPaise}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
