/**
 * Loan math utilities.
 * All monetary values are in paise (integers).
 * Dates are ISO strings (YYYY-MM-DD).
 */

/**
 * Monthly EMI using standard formula: P × r × (1+r)^n / ((1+r)^n − 1)
 * @param principal - loan amount in paise (integer)
 * @param annualRatePercent - annual interest rate as percentage (e.g. 8.5 for 8.5%)
 * @param tenureMonths - total loan duration in months
 * @returns EMI in paise (integer, rounded)
 */
export function calculateEMI(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number,
): number {
  if (annualRatePercent === 0) {
    return Math.round(principal / tenureMonths);
  }
  const r = annualRatePercent / 100 / 12;
  const n = tenureMonths;
  const factor = Math.pow(1 + r, n);
  return Math.round((principal * r * factor) / (factor - 1));
}

/**
 * Total interest paid over the life of the loan.
 * total interest = (EMI * tenureMonths) - principal
 * @returns interest in paise (integer, rounded)
 */
export function totalInterest(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number,
): number {
  const emi = calculateEMI(principal, annualRatePercent, tenureMonths);
  return Math.round(emi * tenureMonths - principal);
}

/**
 * Months remaining given a loan start date and total tenure.
 * @param startDate - ISO date string (YYYY-MM-DD)
 * @param tenureMonths - total loan duration in months
 * @returns months remaining (0 if already ended)
 */
export function monthsRemaining(startDate: string, tenureMonths: number): number {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + tenureMonths);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today >= end) return 0;

  const yearDiff = end.getFullYear() - today.getFullYear();
  const monthDiff = end.getMonth() - today.getMonth();
  const totalMonthDiff = yearDiff * 12 + monthDiff;

  // Adjust if the day-of-month hasn't been reached yet this month
  const dayAdjustment = end.getDate() < today.getDate() ? -1 : 0;
  return Math.max(0, totalMonthDiff + dayAdjustment);
}

/**
 * Percentage of monthly salary consumed by total monthly EMI.
 * @param totalMonthlyEMI - sum of all loan EMIs in paise
 * @param monthlySalary - gross monthly salary in paise
 * @returns percentage value (e.g. 35.5 for 35.5%)
 */
export function salaryConsumptionPercent(
  totalMonthlyEMI: number,
  monthlySalary: number,
): number {
  if (monthlySalary === 0) return 0;
  return (totalMonthlyEMI / monthlySalary) * 100;
}

/**
 * Days remaining until the loan ends.
 * @param startDate - ISO date string (YYYY-MM-DD)
 * @param tenureMonths - total loan duration in months
 * @returns days remaining (0 if already ended)
 */
export function daysRemaining(startDate: string, tenureMonths: number): number {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + tenureMonths);
  end.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - today.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
