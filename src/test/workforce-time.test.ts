import { describe, it, expect } from "vitest";
import { scheduledHours, splitHours, attendanceEarnings, clockRulesSchema } from "@/lib/workforce-time";
describe("workforce attendance payroll", () => {
  it("suggests overnight scheduled hours minus breaks", () => expect(scheduledHours("2026-11-01T22:00:00Z", "2026-11-02T06:00:00Z", 30)).toBe(7.5));
  it("does not invent hours without a schedule", () => expect(scheduledHours(null,null,0)).toBeNull());
  it("applies daily overtime once", () => expect(splitHours([10,10],"daily",8)).toEqual({regular:16,overtime:4}));
  it("uses the chosen weekly threshold", () => expect(splitHours([10,10,10,10],"weekly",36)).toEqual({regular:36,overtime:4}));
  it("rejects unconfirmed missing punches", () => expect(() => attendanceEarnings(25,"Hourly",8,{hours:8,regular:8,overtime:0,pending:1,shifts:1,multiplier:1.5,enabled:true})).toThrow("review"));
  it("calculates hourly regular and overtime pay", () => expect(attendanceEarnings(25,"Hourly",8,{hours:10,regular:8,overtime:2,pending:0,shifts:1,multiplier:1.5,enabled:true})).toEqual({basic:200,overtime:75,hourly:25}));
  it("derives the daily hourly equivalent from contracted hours", () => expect(attendanceEarnings(160,"Daily",8,{hours:4,regular:4,overtime:0,pending:0,shifts:1,multiplier:1.5,enabled:true}).basic).toBe(80));
  it("bounds company overtime settings", () => expect(clockRulesSchema.safeParse({timezone:"America/St_Lucia",basis:"daily",threshold:36,multiplier:1.5,payroll:true}).success).toBe(false));
});