import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
const bodySchema = z.object({ action: z.enum(["status","punch"]), org_id: z.string().uuid().optional(), employee_code: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/).optional(), pin: z.string().regex(/^\d{4,6}$/).optional(), direction: z.enum(["clock_in","clock_out","lunch_out","lunch_in"]).optional(), mode: z.enum(["device","voice","pin"]).default("device"), latitude: z.number().finite().min(-90).max(90).optional(), longitude: z.number().finite().min(-180).max(180).optional() }).strict();
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
   const [access,clockAccess]=await Promise.all([caller.rpc("has_workspace_access",{_user_id:user.id,_module:"attendance"}),caller.rpc("has_employee_clock_access",{_employee:user.id})]); if(!access.data&&!clockAccess.data) return reply({error:"Attendance access required"},403);
   const company=await caller.rpc("current_org_id"); if(!company.data) return reply({error:"Company membership required"},403);
   const employment=await caller.rpc("staff_employment_key");
   if(employment.error||!employment.data) return reply({error:"Unable to verify staff clock identity"},503);
   employee=employment.data; org=company.data;
  }
  const active=await admin.from("payroll_employee_directory").select("user_id").eq("user_id",employee).eq("org_id",org).is("deleted_at",null).ilike("status","active").maybeSingle();
  if(!active.data) return reply({error:"Active employee required"},403);
  const [schedule,company]=await Promise.all([admin.from("workforce_schedules").select("enabled,allowed_methods").eq("org_id",org).eq("employee_id",employee).maybeSingle(),admin.from("organizations").select("enabled_modules").eq("id",org).single()]);
  if(schedule.error||company.error) return reply({error:"Unable to check clock configuration"},503);
  if(!company.data?.enabled_modules.includes("attendance")||!schedule.data?.enabled) return reply({error:"Your code and PIN are correct, but your time clock is switched off. Ask your administrator to turn on \"Employee clock enabled\" in your employee folder."},403);
  const methods=schedule.data.allowed_methods;
  const identityMethod=body.pin?"pin":"account";
  if(!methods.includes(identityMethod)||body.mode==="voice"&&!methods.includes("voice")) return reply({error:"This clock method is not enabled by your administrator"},403);
  if(body.action==="status") {
   const [sh,sc]=await Promise.all([admin.from("workforce_shifts").select("clock_in,clock_out,lunch_out,lunch_in").eq("org_id",org).eq("employee_id",employee).not("clock_in","is",null).is("clock_out",null).order("clock_in",{ascending:false}).limit(1).maybeSingle(),admin.from("workforce_schedules").select("site_id,shift_start,shift_end,days_of_week").eq("org_id",org).eq("employee_id",employee).eq("enabled",true).maybeSingle()]);
   if(sh.error||sc.error) return reply({error:"Unable to read clock status"},500);
   const history=await admin.from("workforce_shifts").select("shift_date,clock_in,clock_out,lunch_out,lunch_in,approved_hours,review_status").eq("org_id",org).eq("employee_id",employee).order("shift_date",{ascending:false}).limit(14);
   if(history.error) return reply({error:"Unable to read worked hours"},500);
   const monthStart=new Date(); monthStart.setUTCDate(1); const ms=monthStart.toISOString().slice(0,10); const today=new Date().toISOString().slice(0,10);
   const [month,person,contact,phone]=await Promise.all([
    admin.from("workforce_shifts").select("shift_date,scheduled_start,clock_in,clock_out,lunch_out,lunch_in,break_minutes,approved_hours").eq("org_id",org).eq("employee_id",employee).gte("shift_date",ms),
    admin.from("payroll_employee_directory").select("first_name,last_name,job_title,department,monthly_salary,hr_details").eq("user_id",employee).eq("org_id",org).maybeSingle(),
    admin.from("user_roles").select("user_id").eq("org_id",org).eq("role","admin").limit(1).maybeSingle(),
    admin.from("company_settings").select("company_name,telephone").eq("org_id",org).maybeSingle()]);
   let hours=0,late=0,missing=0,days=0;
   for(const s of month.data??[]){ if(s.clock_in)days++; if(s.clock_in&&s.scheduled_start&&new Date(s.clock_in).getTime()>new Date(s.scheduled_start).getTime()+5*60000)late++; if(s.clock_in&&!s.clock_out&&s.shift_date<today)missing++;
    if(s.approved_hours!==null)hours+=Number(s.approved_hours); else if(s.clock_in&&s.clock_out){const lunch=s.lunch_out&&s.lunch_in?(new Date(s.lunch_in).getTime()-new Date(s.lunch_out).getTime())/3600000:(s.break_minutes??0)/60;hours+=Math.max(0,(new Date(s.clock_out).getTime()-new Date(s.clock_in).getTime())/3600000-lunch);} }
   const hd=(person.data?.hr_details??{}) as Record<string,unknown>; const weekly=Number(hd.weekly_hours)||40; const salary=Number(person.data?.monthly_salary)||0; const rate=salary?salary*12/52/weekly:0;
   let adminEmail:string|null=null; if(contact.data?.user_id){const p=await admin.from("profiles").select("email").eq("id",contact.data.user_id).maybeSingle();adminEmail=p.data?.email??null;}
   const summary={name:person.data?`${person.data.first_name??""} ${person.data.last_name??""}`.trim():"",job_title:person.data?.job_title??null,department:person.data?.department??null,month_hours:Math.round(hours*100)/100,days_worked:days,times_late:late,missing_punches:missing,hourly_rate:Math.round(rate*100)/100,estimated_earnings:Math.round(hours*rate*100)/100,company:phone.data?.company_name??null,company_phone:phone.data?.telephone??null,company_email:adminEmail};
   return reply({summary,next:!sh.data?"clock_in":sh.data.lunch_out&&!sh.data.lunch_in?"lunch_in":"clock_out",lunch_taken:!!sh.data?.lunch_out,clock_in:sh.data?.clock_in??null,location_required:!!sc.data?.site_id,allowed_methods:methods,history:history.data,schedule:sc.data?{start:sc.data.shift_start,end:sc.data.shift_end,days:sc.data.days_of_week}:null});
  }
  if(!body.direction) return reply({error:"Choose clock in or clock out"},400);
  if(body.latitude===undefined||body.longitude===undefined) return reply({error:"Location is required to clock in or out. Turn on location for this browser and try again."},400);
  const result=await admin.rpc("record_workforce_punch",{_employee:employee,_org:org,_direction:body.direction,_mode:body.pin?"pin":body.mode,_lat:body.latitude??null,_lon:body.longitude??null});
  if(result.error) return reply({error:result.error.message},400);
  return reply(result.data);
 } catch { return reply({error:"Time clock request failed. Please try again."},400); }
});