import { z } from "zod";
export const simulationStartSchema = z.date().min(new Date("2000-01-01T00:00:00Z")).max(new Date("2100-12-31T23:59:59Z"));
export function simulatedTime(start: string, realStart: string, now: number) {
  return new Date(new Date(start).getTime() + now - new Date(realStart).getTime());
}
export function nextSimulatedPunch(lastType?: string) { return lastType === "clock_in" ? "clock_out" : "clock_in"; }