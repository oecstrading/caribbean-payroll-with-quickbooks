import { useEffect, useState } from "react";
import ClockReminders from "@/components/ClockReminders";
import type { ClockSchedule } from "@/lib/clock-reminders";
import { Clock, LogIn, LogOut, Mic, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import StaffPayCenter from "@/components/StaffPayCenter";

export default function StaffTimeClock({ companyId }: { companyId?: string }) {
 const { user }=useAuth(); const [now,setNow]=useState(new Date()); const [code,setCode]=useState(""); const [pin,setPin]=useState(""); const [next,setNext]=useState<"clock_in"|"clock_out">("clock_in"); const [busy,setBusy]=useState(false); const [pinMode,setPinMode]=useState(!!companyId); const [known,setKnown]=useState(false); const [last,setLast]=useState(""); const [error,setError]=useState("");
 const [resolvedCompany,setResolvedCompany]=useState(companyId??"");
 const [methods,setMethods]=useState<string[]>([]);
 const [schedule,setSchedule]=useState<ClockSchedule|null>(null);
 const [history,setHistory]=useState<{shift_date:string;clock_in:string|null;clock_out:string|null;approved_hours:number|null;review_status:string}[]>([]);
 useEffect(()=>{if(companyId){setResolvedCompany(companyId);return;}if(user)void supabase.rpc("current_org_id").then(({data})=>setResolvedCompany(data??""));},[companyId,user?.id]);
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
 async function request(action:"status"|"punch", mode="device") {
  const body: Record<string,unknown>={action,mode};
  if(pinMode) { if(!resolvedCompany||!code||!/^\d{4,6}$/.test(pin)) throw new Error("Enter your employee code and 4–6 digit PIN"); Object.assign(body,{org_id:resolvedCompany,employee_code:code,pin}); }
  if(action==="punch") {
   body.direction=next;
   // Every punch must carry the device location (anti buddy-punching); the server rejects punches without it.
   const position=await new Promise<GeolocationPosition|null>(resolve=>{if(!navigator.geolocation)return resolve(null);const deadline=window.setTimeout(()=>resolve(null),15500);navigator.geolocation.getCurrentPosition(p=>{clearTimeout(deadline);resolve(p);},()=>{clearTimeout(deadline);resolve(null);},{enableHighAccuracy:true,timeout:15000,maximumAge:0});});
   if(!position)throw new Error("Location is required to clock in or out. Allow location access for this site and try again.");
   Object.assign(body,{latitude:position.coords.latitude,longitude:position.coords.longitude});
  }
  const {data,error}=await supabase.functions.invoke("workforce-clock",{body});
  if(error) { let message=error.message; if(error.context instanceof Response){const detail=await error.context.json().catch(()=>null);message=detail?.error??message;} throw new Error(message); }
  if(data?.error)throw new Error(data.error);
  setNext(data.next);setKnown(true);if(data.history)setHistory(data.history);if(data.allowed_methods)setMethods(data.allowed_methods);if(data.schedule!==undefined)setSchedule(data.schedule);if(action==="punch"){setLast(`${next==="clock_in"?"Clocked in":"Clocked out"} · ${new Date(data.punched_at).toLocaleTimeString()}`);await request("status",mode);setPin("");toast.success("Attendance saved");}
 }
 useEffect(()=>{if(user&&!pinMode)void request("status").catch(e=>setError(e.message));},[user?.id,pinMode]);
 async function submit(mode="device") {setBusy(true);setError("");try{await request(pinMode&&!known?"status":"punch",mode);}catch(e){setError(e instanceof Error?e.message:"Clock unavailable");}finally{setBusy(false);}}
 async function voice() {
  const w=window as unknown as {SpeechRecognition?:new()=>{lang:string;start:()=>void;onresult:(e:{results:{[key:number]:{[key:number]:{transcript:string}}}})=>void;onerror:()=>void};webkitSpeechRecognition?:new()=>{lang:string;start:()=>void;onresult:(e:{results:{[key:number]:{[key:number]:{transcript:string}}}})=>void;onerror:()=>void}};
  const Recognition=w.SpeechRecognition??w.webkitSpeechRecognition;
  if(!Recognition){toast.error("Voice recognition is unavailable; use the clock button.");return;}
  const r=new Recognition();r.lang="en-US";r.onresult=e=>{const text=e.results[0]?.[0]?.transcript?.toLowerCase()??"";if(text.includes(next==="clock_in"?"clock in":"clock out"))void submit("voice");else toast.info(`Say ${next==="clock_in"?"clock in":"clock out"}`);};r.onerror=()=>toast.error("Microphone unavailable; use the clock button.");r.start();
 }
 return <section aria-label="Mobile Time Clock" className="max-w-xl mx-auto w-full border-2 border-destructive rounded-lg bg-card p-6 sm:p-8 space-y-5 text-center shadow-card">
  <h2 className="font-display text-xl font-bold flex justify-center items-center gap-2"><Clock className="text-destructive"/>Mobile Time Clock</h2>
  <time className="block font-display font-bold text-4xl sm:text-5xl tabular-nums min-h-14">{now.toLocaleTimeString("en-US")}</time><p className="text-sm text-muted-foreground">{now.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})}</p>
  {resolvedCompany&&user&&<div className="flex gap-2 justify-center"><Button variant={!pinMode?"secondary":"ghost"} onClick={()=>{setPinMode(false);setKnown(false);setHistory([]);}}>My account</Button><Button variant={pinMode?"secondary":"ghost"} onClick={()=>{setPinMode(true);setKnown(false);setHistory([]);}}>Employee PIN</Button></div>}
  {pinMode&&<div className="text-left space-y-4"><div className="space-y-2"><Label htmlFor="clock-code">Employee code</Label><Input id="clock-code" autoComplete="username" value={code} maxLength={40} onChange={e=>{setCode(e.target.value);setKnown(false);}}/></div><div className="space-y-2"><Label htmlFor="clock-pin">PIN</Label><Input id="clock-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} className="h-14 text-center text-2xl" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}/></div></div>}
  {!user&&!pinMode?<p className="text-muted-foreground">Sign in or use your company's employee clock link.</p>:<Button className="w-full h-16 text-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy} onClick={()=>void submit()}>{next==="clock_in"?<LogIn/>:<LogOut/>}{busy?"Recording…":pinMode&&!known?"Check employee clock":next==="clock_in"?"Clock In":"Clock Out"}</Button>}
  {known&&methods.includes("voice")&&<Button variant="ghost" disabled={busy} onClick={()=>void voice()}><Mic size={16}/>Voice clock {next==="clock_in"?"in":"out"}</Button>}
  {known&&history.length>0&&<div className="border-t border-border pt-4 text-left space-y-2"><h3 className="font-semibold">My worked hours</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="py-2 text-left">Date</th><th>In</th><th>Out</th><th className="text-right">Hours</th></tr></thead><tbody>{history.map(h=><tr key={h.shift_date} className="border-t border-border"><td className="py-3">{h.shift_date}</td><td className="text-center">{h.clock_in?new Date(h.clock_in).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"Missing"}</td><td className="text-center">{h.clock_out?new Date(h.clock_out).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—"}</td><td className="text-right">{h.approved_hours===null?"Pending":Number(h.approved_hours).toFixed(2)}</td></tr>)}</tbody></table></div></div>}
  {known&&<ClockReminders schedule={schedule} next={next}/>}
  {user&&!pinMode&&known&&<StaffPayCenter/>}
  {last&&<p role="status" className="text-success font-medium">{last}</p>}{error&&<p role="alert" className="text-destructive text-sm">{error}</p>}
  <p className="text-xs text-muted-foreground flex justify-center items-center gap-2"><ShieldCheck size={14}/>Live attendance · Company-protected records</p>
 </section>;
}