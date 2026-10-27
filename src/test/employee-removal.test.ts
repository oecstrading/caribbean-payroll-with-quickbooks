import { describe, expect, it } from "vitest";
import { removalAllowed, validRemovalBody } from "../../supabase/functions/delete-employee/policy";

const actor = { id: "actor", org_id: "smiley", admin: true, hr: true };
const target = { id: "employee", org_id: "smiley", admin: false, platform: false };
describe("permanent employee removal authorization", () => {
  it("allows a company admin to remove an employee in their company", () => expect(removalAllowed(actor, target)).toBe(true));
  it("denies managers and employees", () => expect(removalAllowed({ ...actor, admin: false }, target)).toBe(false));
  it("denies another company's employee", () => expect(removalAllowed(actor, { ...target, org_id: "other" })).toBe(false));
  it("denies self deletion", () => expect(removalAllowed(actor, { ...target, id: actor.id })).toBe(false));
  it("protects administrator accounts", () => expect(removalAllowed(actor, { ...target, admin: true })).toBe(false));
  it("protects platform administrator accounts", () => expect(removalAllowed(actor, { ...target, platform: true })).toBe(false));
  it("lets a company super admin remove another company admin", () => expect(removalAllowed({ ...actor, superAdmin: true }, { ...target, admin: true })).toBe(true));
  it("lets a platform and company super admin remove another platform admin in the same company", () => expect(removalAllowed({ ...actor, superAdmin: true, platform: true }, { ...target, admin: true, platform: true })).toBe(true));
  it("does not let company-only super admins remove platform admins", () => expect(removalAllowed({ ...actor, superAdmin: true }, { ...target, admin: true, platform: true })).toBe(false));
  it("does not let platform authority cross tenant boundaries", () => expect(removalAllowed({ ...actor, superAdmin: true, platform: true }, { ...target, org_id: "other", admin: true, platform: true })).toBe(false));
  it("requires enabled HR access", () => expect(removalAllowed({ ...actor, hr: false }, target)).toBe(false));
  it("requires company membership", () => expect(removalAllowed({ ...actor, org_id: null }, { ...target, org_id: null })).toBe(false));
  it("requires explicit DELETE confirmation", () => {
    const employee_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
    expect(validRemovalBody({ employee_id, confirmation: "DELETE" })).toBe(true);
    expect(validRemovalBody({ employee_id, confirmation: "" })).toBe(false);
  });
});