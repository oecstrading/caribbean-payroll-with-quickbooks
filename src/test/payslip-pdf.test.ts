import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { linesFromText, parsePayslips, learnNicBasis, rebuildSlip, matchEmployee } from "@/lib/payslip-pdf";

const slips = parsePayslips(linesFromText(readFileSync("src/test/fixtures/smiley-paystubs-oct31.txt", "utf8")));

describe("pay slip import (Smiley, 31 Oct 2026)", () => {
  it("reads all four stubs", () => expect(slips.map(s => s.name)).toEqual(["AJAYE GIDEON", "BRIAN JUSTIN", "DECOSTA SERVAIS", "LORIANN HOPE"]));
  it("learns that bonuses are excluded from NIC", () => expect(learnNicBasis(slips)).toEqual({ basis: "gross_less_bonus", matches: 4 }));
  it("rebuilds every net pay to the cent", () => {
    const nets = slips.map(s => rebuildSlip(s, { basis: "gross_less_bonus", paye: "as_slips" }).net);
    expect(nets).toEqual([513.84, 748.56, 2284.88, 1222.56]);
  });
  it("matches Brian to Bryan by last name and initial", () => {
    expect(matchEmployee("BRIAN JUSTIN", [{ first_name: "Bryan", last_name: "Justin" }])?.first_name).toBe("Bryan");
  });
});
