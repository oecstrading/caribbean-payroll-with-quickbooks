import { describe, expect, it } from "vitest";
import { activationCode, kioskActivationLink, validActivationCode } from "@/lib/kiosk-setup";

describe("shared clock activation", () => {
  it("accepts the administrator's code from a QR or shared link without typing", () => {
    const link = new URL(kioskActivationLink("724975CA"));
    expect(link.pathname).toBe("/kiosk");
    expect(link.search).toBe("");
    expect(activationCode(link.search, link.hash)).toBe("724975CA");
  });
  it("keeps previously sent query-code links working", () => {
    expect(activationCode("?code=724975ca", "")).toBe("724975CA");
  });
  it("rejects malformed activation codes before automatically activating", () => {
    expect(validActivationCode("724975CA")).toBe(true);
    expect(validActivationCode("../../admin")).toBe(false);
    expect(validActivationCode("123")).toBe(false);
  });
});