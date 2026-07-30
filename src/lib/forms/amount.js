/** Parse the accounting-style amount display back into a number. */
export function parseAmount(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim().replaceAll(',', '');
  if (!text) return NaN;
  const negative = text.startsWith('(') && text.endsWith(')');
  const numeric = text.replace(/[()]/g, '');
  const amount = Number(numeric);
  return negative ? -amount : amount;
}

/** Web equivalent of _(#,##0_);[Red](#,##0). */
export function formatAmount(value) {
  const amount = parseAmount(value);
  if (!Number.isFinite(amount)) return '';
  const rounded = Math.round(amount);
  const formatted = Math.abs(rounded).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });
  return rounded < 0 ? `(${formatted})` : formatted;
}
