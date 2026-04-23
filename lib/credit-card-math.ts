/**
 * Credit-card math utilities.
 * All monetary values are in paise (integers).
 * Dates are ISO strings (YYYY-MM-DD).
 */

const MINIMUM_DUE_FLOOR_PAISE = 200; // ₹2 expressed in paise
const MINIMUM_DUE_PERCENT = 0.05; // 5%
const DUE_SOON_DAYS = 5;

/** Format a Date as YYYY-MM-DD. */
function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Last day of a given month (1-indexed). */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
}

/**
 * Clamp a day-of-month to the actual last day of the given month.
 */
function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, lastDayOfMonth(year, month));
}

/**
 * Calculate the last date to pay without incurring interest.
 * Steps:
 *   1. Find the billing cycle end date on or after the transaction date.
 *   2. Add interestFreeDays to get the interest-free period end.
 *
 * @param transactionDate - ISO date string (YYYY-MM-DD)
 * @param billingCycleDay - day of month the billing cycle ends (1–31)
 * @param interestFreeDays - days after billing cycle end to pay (default 45)
 * @returns ISO date string of interest-free period end
 */
export function interestFreePeriodEnd(
  transactionDate: string,
  billingCycleDay: number,
  interestFreeDays: number = 45,
): string {
  const txDate = new Date(transactionDate);
  let year = txDate.getFullYear();
  let month = txDate.getMonth() + 1; // 1-indexed

  // Find the billing cycle end date on or after transactionDate
  const clamped = clampDay(year, month, billingCycleDay);
  let billingEnd: Date;

  if (txDate.getDate() <= clamped) {
    // Billing cycle ends this month on or after the transaction
    billingEnd = new Date(year, month - 1, clamped);
  } else {
    // Billing cycle end already passed this month — use next month
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    const clampedNext = clampDay(year, month, billingCycleDay);
    billingEnd = new Date(year, month - 1, clampedNext);
  }

  // Add interestFreeDays
  const dueDate = new Date(billingEnd);
  dueDate.setDate(dueDate.getDate() + interestFreeDays);
  return toISODate(dueDate);
}

/**
 * Minimum due = max(5% of outstanding balance, 200 paise).
 * @param balance - outstanding balance in paise (integer)
 * @returns minimum due in paise (integer)
 */
export function calculateMinimumDue(balance: number): number {
  const fivePercent = Math.round(balance * MINIMUM_DUE_PERCENT);
  return Math.max(fivePercent, MINIMUM_DUE_FLOOR_PAISE);
}

/**
 * Returns true if payment due date is within 5 days from today (inclusive).
 * @param dueDate - ISO date string (YYYY-MM-DD)
 */
export function isPaymentDueSoon(dueDate: string): boolean {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= DUE_SOON_DAYS;
}

/**
 * Calculate next billing due date from billing cycle day.
 * Returns the next occurrence of billingCycleDay that is in the future
 * (i.e. the first billing date that hasn't passed yet).
 *
 * @param billingCycleDay - day of month (1–31)
 * @returns ISO date string of next due date
 */
export function nextBillingDate(billingCycleDay: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let year = today.getFullYear();
  let month = today.getMonth() + 1; // 1-indexed

  const clamped = clampDay(year, month, billingCycleDay);
  const thisMonthDate = new Date(year, month - 1, clamped);

  if (thisMonthDate >= today) {
    return toISODate(thisMonthDate);
  }

  // Move to next month
  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  const clampedNext = clampDay(year, month, billingCycleDay);
  return toISODate(new Date(year, month - 1, clampedNext));
}
