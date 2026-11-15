/** Company rule: a shift of 7.51 hours or more (but under 8) counts as a full 8 hours. */
export const ROUND_UP_FROM = 7.51;
export function roundShiftHours(h: number): number {
  return Math.round(h * 100) / 100 >= ROUND_UP_FROM && h < 8 ? 8 : h;
}

/** Upward rounding without promoting exact decimal boundaries due to floating-point noise. */
export function roundTimeUp(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error("Enter valid non-negative hours or minutes");
  return Math.max(0, Math.ceil(value * 100 - 1e-9) / 100);
}

export function reviewedHours(value: number, wholeHour = false): number {
  const rounded = roundTimeUp(value);
  if (rounded > 24) throw new Error("Hours must not exceed 24");
  return wholeHour ? Math.ceil(rounded) : rounded;
}
