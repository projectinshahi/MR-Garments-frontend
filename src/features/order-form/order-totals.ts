// Totals for the New order and Edit order forms: line amounts and the order total. Money is rounded to cents so float
// noise (6.2 × 2,400) never shows.

const cents = (value: number) => Math.round(value * 100) / 100;

/** "2,400" → 2400; empty or invalid input counts as 0. */
export const parseNumber = (text: string) => Number(text.replace(/,/g, "")) || 0;

export const lineAmount = (line: { rate: number; quantity: number }) => cents(line.rate * line.quantity);

/** The order value as the API counts it: round(Σ quantity × rate, 2), rounded once over the raw sum. */
export const orderTotal = (lines: { rate: number; quantity: number }[]) => cents(lines.reduce((sum, line) => sum + line.rate * line.quantity, 0));
