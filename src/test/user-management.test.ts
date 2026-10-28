import { describe, expect, it } from "vitest";
import { accountSchema, mayManageAccount, personalSchema, personalFields } from "../../supabase/functions/_shared/user-management";
describe("user and staff access",()=>{
 it("allows a username and PIN without email",()=>{expect(accountSchema.safeParse({username:"staff.one",pin:"482931",is_employee:false,role:"manager"}).success).toBe(true)});
 it("requires a PIN for a new no-email account",()=>{expect(accountSchema.safeParse({username:"staff.one"}).success).toBe(false)});
 it("allows email invitations without PIN",()=>{expect(accountSchema.safeParse({email:"staff@example.com"}).success).toBe(true)});
 it("normalizes unique username identities",()=>{expect(accountSchema.parse({username:"Staff.One",pin:"482931"}).username).toBe("staff.one")});
 it("allows new login linked to an existing durable employee",()=>{expect(accountSchema.parse({employee_id:"11111111-1111-4111-8111-111111111111",username:"staff.one",pin:"482931"}).employee_id).toBe("11111111-1111-4111-8111-111111111111")});
 it("rejects linking through an account update",()=>{expect(accountSchema.safeParse({action:"update",user_id:"22222222-2222-4222-8222-222222222222",employee_id:"11111111-1111-4111-8111-111111111111"}).success).toBe(false)});
 it("denies managers account administration",()=>{expect(mayManageAccount("manager",true,false,false,false,false)).toBe(false)});
 it("denies cross-company account changes even to super admins",()=>{expect(mayManageAccount("admin",false,false,true,false,true)).toBe(false)});
 it("requires company authority to manage another admin",()=>{expect(mayManageAccount("admin",true,true,false,false,false)).toBe(false);expect(mayManageAccount("admin",true,true,true,false,false)).toBe(true)});
 it("keeps platform authority independent",()=>{expect(mayManageAccount("admin",true,true,true,true,false)).toBe(false)});
 const details=Object.fromEntries(personalFields.map(k=>[k,""]));
 it("saves emergency details aligned with HR fields",()=>{expect(personalSchema.parse({...details,emergency_name:"Next of kin",address:"Castries"}).emergency_name).toBe("Next of kin")});
 it("refuses self-service pay changes",()=>{expect(personalSchema.safeParse({...details,pay_rate:"9000"}).success).toBe(false)});
 it("refuses self-service privilege changes",()=>{expect(personalSchema.safeParse({...details,role:"admin"}).success).toBe(false)});
});