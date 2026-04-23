/**
 * Currency formatting for the app.
 * Money is stored as integer poisha (1 taka = 100 poisha).
 * Locale: en-BD with the Taka symbol (৳) prepended explicitly so the
 * symbol is consistent across browsers (some render BDT as "Tk" or "BDT").
 */

const nf = new Intl.NumberFormat("en-BD", {
  maximumFractionDigits: 0,
});

const nfPrecise = new Intl.NumberFormat("en-BD", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatTaka(poisha: number, opts: { precise?: boolean } = {}): string {
  const taka = (poisha ?? 0) / 100;
  return `৳${(opts.precise ? nfPrecise : nf).format(taka)}`;
}

/** Same as formatTaka but with no symbol — for chart axis labels etc. */
export function formatTakaCompact(poisha: number): string {
  return nf.format((poisha ?? 0) / 100);
}
