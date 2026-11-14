/** Company rule: a shift of 7.51 hours or more (but under 8) counts as a full 8 hours. */
export const ROUND_UP_FROM = 7.51;
export function roundShiftHours(h: number): number {
  return Math.round(h * 100) / 100 >= ROUND_UP_FROM && h < 8 ? 8 : h;
}
