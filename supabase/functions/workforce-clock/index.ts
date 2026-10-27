import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
const bodySchema = z.object({ action: z.enum(["status","punch"]), org_id: z.string().uuid().optional(), employee_code: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/).optional(), pin: z.string().regex(/^\d{4,6}$/).optional(), direction: z.enum(["clock_in","clock_out"]).optional(), mode: z.enum(["device","voice","pin"]).default("device"), latitude: z.number().finite().min(-90).max(90).optional(), longitude: z.number().finite().min(-180).max(180).optional() }).strict();
const reply = (data: unknown, status=200) => new Response(JSON.stringify(data), {status, headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async req => {
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return reply({error:"Method not allowed"},405);
 try {
  const parsed=bodySchema.safeParse(await req.json()); if(!parsed.success) return reply({error:"Enter a valid employee code and PIN"},400);
  const body=parsed.data;
  const url=Deno.env.get("SUPABASE_URL"); const anon=Deno.env.get("SUPABASE_ANON_KEY"); const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!key) return reply({error:"Time clock temporarily unavailable"},503);
  const admin=createClient(url,key); let employee: string|null=null; let org: string|null=null;
  if(body.pin&&body.employee_code&&body.org_id) {
   const result=await admin.rpc("workforce_pin_employee",{_org:body.org_id,_code:body.employee_code,_pin:body.pin});
   if(result.error||!result.data) return reply({error:"Employee code or PIN not accepted. Repeated failures temporarily lock the clock."},403);
   employee=result.data; org=body.org_id;
  } else {
   const authorization=req.headers.get("Authorization"); if(!authorization?.startsWith("Bearer ")) return reply({error:"Sign in or enter your company employee code and PIN"},401);
   const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
   const {data:{user},error}=await caller.auth.getUser(); if(error||!user) return reply({error:"Sign in or enter your employee code and PIN"},401);
   const access=await caller.rpc("has_workspace_access",{_user_id:user.id,_module:"attendance"}); if(!access.data) return reply({error:"Attendance access required"},403);
   const company=await caller.rpc("current_org_id"); if(!company.data) return reply({error:"Company membership required"},403);
   employee=user.id; org=company.data;
  }
  const active=await admin.from("payroll_employee_directory").select("user_id").eq("user_id",employee).eq("org_id",org).is("deleted_at",null).ilike("status","active").maybeSingle();
  if(!active.data) return reply({error:"Active employee required"},403);
  if(body.action==="status") {
   const [sh,sc]=await Promise.all([admin.from("workforce_shifts").select("clock_in,clock_out").eq("org_id",org).eq("employee_id",employee).not("clock_in","is",null).is("clock_out",null).order("clock_in",{ascending:false}).limit(1).maybeSingle(),admin.from("workforce_schedules").select("site_id").eq("org_id",org).eq("employee_id",employee).eq("enabled",true).maybeSingle()]);
   if(sh.error||sc.error) return reply({error:"Unable to read clock status"},500);
   return reply({next:sh.data?"clock_out":"clock_in",clock_in:sh.data?.clock_in??null,location_required:!!sc.data?.site_id});
  }
  if(!body.direction) return reply({error:"Choose clock in or clock out"},400);
  const result=await admin.rpc("record_workforce_punch",{_employee:employee,_org:org,_direction:body.direction,_mode:body.pin?"pin":body.mode,_lat:body.latitude??null,_lon:body.longitude??null});
  if(result.error) return reply({error:result.error.message},400);
  return reply(result.data);
 } catch { return reply({error:"Time clock request failed. Please try again."},400); }
});