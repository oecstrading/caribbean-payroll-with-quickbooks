import { clockDeviceId, isInAppBrowser } from "@/lib/clock-device-id";
import { useEffect, useState } from "react";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import ClockReminders from "@/components/ClockReminders";
import type { ClockSchedule } from "@/lib/clock-reminders";
import { Clock, LayoutDashboard, LogIn, LogOut, Mic, ShieldCheck, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { rememberedClockCode, rememberClockCode } from "@/lib/staff-clock-link";
import StaffPayCenter from "@/components/StaffPayCenter";
import StaffDashboard, { type StaffSummary } from "@/components/StaffDashboard";
import { discardPunch, isNetworkFailure, onQueueChange, queuePunch, queuedPunches, startPunchSync, syncPunches, type QueuedPunch } from "@/lib/offline-punches";
import { CloudOff, RefreshCw } from "lucide-react";

type Dir="clock_in"|"clock_out"|"lunch_out"|"lunch_in";
const LABEL:Record<Dir,string>={clock_in:"Clock In",clock_out:"Clock Out",lunch_out:"Out to Lunch",lunch_in:"Back from Lunch"};
const DONE:Record<Dir,string>={clock_in:"Clocked in",clock_out:"Clocked out",lunch_out:"Out to lunch",lunch_in:"Back from lunch"};
export default function StaffTimeClock({ companyId }: { companyId?: string }) {
 const { user }=useAuth(); const [now,setNow]=useState(new Date()); const [code,setCode]=useState(""); const [pin,setPin]=useState(""); const [next,setNext]=useState<Dir>("clock_in"); const [lunchTaken,setLunchTaken]=useState(false); const [busy,setBusy]=useState(false); const [pinMode,setPinMode]=useState(!!companyId); const [known,setKnown]=useState(false); const [last,setLast]=useState(""); const [error,setError]=useState("");
 const [resolvedCompany,setResolvedCompany]=useState(companyId??"");
 const [summary,setSummary]=useState<StaffSummary|null>(null); const [tab,setTab]=useState<"clock"|"me">("clock");
 const [methods,setMethods]=useState<string[]>([]);
 const [schedule,setSchedule]=useState<ClockSchedule|null>(null);
 const [history,setHistory]=useState<{shift_date:string;clock_in:string|null;clock_out:string|null;lunch_out?:string|null;lunch_in?:string|null;approved_hours:number|null;review_status:string}[]>([]);
 useEffect(()=>{if(companyId){setResolvedCompany(companyId);return;}if(user)void supabase.rpc("current_org_id").then(({data})=>setResolvedCompany(data??""));},[companyId,user?.id]);
 useEffect(()=>{if(companyId)try{localStorage.setItem("last-clock-page",window.location.pathname);}catch{/* private mode */}},[companyId]);
 useEffect(()=>{if(!companyId)return;const fromLink=new URLSearchParams(window.location.search).get("code")?.trim();const c=fromLink||rememberedClockCode(companyId);if(c)setCode(c);if(fromLink)rememberClockCode(companyId,fromLink);},[companyId]);
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
 const [online,setOnline]=useState(navigator.onLine); const [queue,setQueue]=useState<QueuedPunch[]>(queuedPunches());
 useEffect(()=>{const up=()=>setOnline(navigator.onLine);window.addEventListener("online",up);window.addEventListener("offline",up);const off=onQueueChange(()=>setQueue(queuedPunches()));startPunchSync(r=>{if(r.sent)toast.success(`${r.sent} offline punch${r.sent>1?"es":""} synced — waiting for manager check`);if(r.failed)toast.error("An offline punch was not accepted. See the clock screen.");});return()=>{window.removeEventListener("online",up);window.removeEventListener("offline",up);off();};},[]);
 const stateKey=()=>`clock-next:${resolvedCompany}:${pinMode?code.trim().toLowerCase():user?.id??""}`;
 const cachedNext=()=>{try{return localStorage.getItem(stateKey()) as Dir|null;}catch{return null;}};
 const cacheNext=(d:Dir)=>{try{localStorage.setItem(stateKey(),d);}catch{/* private mode */}};
 async function request(action:"status"|"punch", mode="device", dir:Dir=next) {
  const body: Record<string,unknown>={action,mode};
  if(pinMode) { if(!resolvedCompany||!code.trim()||!/^\d{4,6}$/.test(pin.trim())) throw new Error("Enter your employee code and 4–6 digit PIN"); if(isInAppBrowser()) throw new Error("This link opened inside WhatsApp/Facebook. Tap ⋮ (top right) → “Open in Chrome” (iPhone: open in Safari), then clock in there so your phone is recognised."); Object.assign(body,{org_id:resolvedCompany,employee_code:code.trim(),pin:pin.trim(),device_id:clockDeviceId()}); }
  if(action==="punch") {
   body.direction=dir;
   // Every punch must carry the device location (anti buddy-punching); the server rejects punches without it.
   const position=await new Promise<GeolocationPosition|null>(resolve=>{if(!navigator.geolocation)return resolve(null);const deadline=window.setTimeout(()=>resolve(null),15500);navigator.geolocation.getCurrentPosition(p=>{clearTimeout(deadline);resolve(p);},()=>{clearTimeout(deadline);resolve(null);},{enableHighAccuracy:true,timeout:15000,maximumAge:0});});
   if(!position)throw new Error("Location is required to clock in or out. Allow location access for this site and try again.");
   Object.assign(body,{latitude:position.coords.latitude,longitude:position.coords.longitude});
  }
  const goOffline=()=>{
   if(action==="status"){const c=cachedNext();if(!c)throw new Error("No internet. Connect once to check your clock, then you can punch offline.");setNext(c);setLunchTaken(c==="lunch_in"||(c==="clock_out"&&lunchTaken));setKnown(true);return;}
   queuePunch({direction:dir,latitude:body.latitude as number,longitude:body.longitude as number,mode:pinMode?"pin":mode,...(pinMode?{org_id:resolvedCompany,employee_code:code.trim(),pin:pin.trim()}:{})});
   const nx:Dir=dir==="clock_in"||dir==="lunch_in"?"clock_out":dir==="lunch_out"?"lunch_in":"clock_in";
   setNext(nx);if(dir==="lunch_out")setLunchTaken(true);if(dir==="clock_out")setLunchTaken(false);cacheNext(nx);
   setLast(`${DONE[dir]} · ${new Date().toLocaleTimeString()} · saved offline`);toast.success(`${DONE[dir]} — saved on this phone. It will send when internet returns.`);
  };
  if(!navigator.onLine){goOffline();return;}
  let res;
  try{res=await supabase.functions.invoke("workforce-clock",{body});}catch(e){if(isNetworkFailure(e)){goOffline();return;}throw e;}
  const {data,error}=res;
  if(error&&!(error.context instanceof Response)&&isNetworkFailure(error)){goOffline();return;}
  if(error) { let message=error.message; if(error.context instanceof Response){const detail=await error.context.json().catch(()=>null);message=detail?.error??message;} throw new Error(message); }
  if(data?.error)throw new Error(data.error);
  if(data?.not_employee){if(resolvedCompany)setPinMode(true);throw new Error("Your sign-in isn't an employee clock for this company. Use the Employee PIN option to clock in.");}
  if(data.next)cacheNext(data.next);setNext(data.next);if(data.lunch_taken!==undefined)setLunchTaken(!!data.lunch_taken);setKnown(true);if(pinMode&&resolvedCompany)rememberClockCode(resolvedCompany,code.trim());if(data.history)setHistory(data.history);if(data.summary)setSummary(data.summary);if(data.allowed_methods)setMethods(data.allowed_methods);if(data.schedule!==undefined)setSchedule(data.schedule);if(action==="punch"){setLast(`${DONE[dir]} · ${new Date(data.punched_at).toLocaleTimeString()}`);await request("status",mode).catch(()=>undefined);toast.success(`${DONE[dir]} — attendance saved`);}
 }
 useEffect(()=>{if(user&&!pinMode)void request("status").catch(e=>setError(e.message));},[user?.id,pinMode]);
 async function submit(mode="device",dir:Dir=next) {setBusy(true);setError("");try{await request(pinMode&&!known?"status":"punch",mode,dir);}catch(e){setError(e instanceof Error?e.message:"Clock unavailable");}finally{setBusy(false);}}
 async function voice() {
  const w=window as unknown as {SpeechRecognition?:new()=>{lang:string;start:()=>void;onresult:(e:{results:{[key:number]:{[key:number]:{transcript:string}}}})=>void;onerror:()=>void};webkitSpeechRecognition?:new()=>{lang:string;start:()=>void;onresult:(e:{results:{[key:number]:{[key:number]:{transcript:string}}}})=>void;onerror:()=>void}};
  const Recognition=w.SpeechRecognition??w.webkitSpeechRecognition;
  if(!Recognition){toast.error("Voice recognition is unavailable; use the clock button.");return;}
  const r=new Recognition();r.lang="en-US";r.onresult=e=>{const text=e.results[0]?.[0]?.transcript?.toLowerCase()??"";if(text.includes(next==="clock_in"?"clock in":"clock out"))void submit("voice");else toast.info(`Say ${next==="clock_in"?"clock in":"clock out"}`);};r.onerror=()=>toast.error("Microphone unavailable; use the clock button.");r.start();
 }
 return <section aria-label="Mobile Time Clock" className="max-w-xl mx-auto w-full border-2 border-destructive rounded-lg bg-card p-6 sm:p-8 space-y-5 text-center shadow-card">
  <h2 className="font-display text-xl font-bold flex justify-center items-center gap-2"><Clock className="text-destructive"/>Mobile Time Clock</h2>
  <time className="block font-display font-bold text-4xl sm:text-5xl tabular-nums min-h-14">{now.toLocaleTimeString("en-US")}</time><p className="text-sm text-muted-foreground">{now.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})}</p>
  <AddToHomeScreen staffClock/>
  {resolvedCompany&&user&&<div className="flex gap-2 justify-center"><Button variant={!pinMode?"secondary":"ghost"} onClick={()=>{setPinMode(false);setKnown(false);setHistory([]);}}>My account</Button><Button variant={pinMode?"secondary":"ghost"} onClick={()=>{setPinMode(true);setKnown(false);setHistory([]);}}>Employee PIN</Button></div>}
  {known&&summary&&<div role="tablist" className="grid grid-cols-2 gap-2"><Button role="tab" aria-selected={tab==="clock"} variant={tab==="clock"?"default":"outline"} onClick={()=>setTab("clock")}><Clock size={16}/>Clock</Button><Button role="tab" aria-selected={tab==="me"} variant={tab==="me"?"default":"outline"} onClick={()=>setTab("me")}><LayoutDashboard size={16}/>My dashboard</Button></div>}
  {known&&summary&&tab==="me"?<StaffDashboard summary={summary}/>:<>
  {pinMode&&<div className="text-left space-y-4"><div className="space-y-2"><Label htmlFor="clock-code">Employee code</Label><Input id="clock-code" autoComplete="username" value={code} maxLength={40} onChange={e=>{setCode(e.target.value);setKnown(false);}}/></div><div className="space-y-2"><Label htmlFor="clock-pin">PIN</Label><Input id="clock-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} className="h-14 text-center text-2xl" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}/></div></div>}
  {!user&&!pinMode?<p className="text-muted-foreground">Sign in or use your company's employee clock link.</p>
   :!known||next==="clock_in"?<Button className="w-full h-16 text-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy} onClick={()=>void submit("device","clock_in")}><LogIn/>{busy?"Recording…":pinMode&&!known?"Check employee clock":LABEL.clock_in}</Button>
   :<div className="space-y-3">
     <p className="text-sm font-medium">{next==="lunch_in"?"You are on lunch.":"You are clocked in."}</p>
     {next==="lunch_in"?<Button className="w-full h-16 text-xl" disabled={busy} onClick={()=>void submit("device","lunch_in")}><Utensils/>{busy?"Recording…":LABEL.lunch_in}</Button>
      :!lunchTaken&&<Button variant="outline" className="w-full h-14 text-lg border-2 border-warning" disabled={busy} onClick={()=>void submit("device","lunch_out")}><Utensils/>{busy?"Recording…":LABEL.lunch_out}</Button>}
     <Button className="w-full h-16 text-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy} onClick={()=>void submit("device","clock_out")}><LogOut/>{busy?"Recording…":"Clock Out · End shift"}</Button>
   </div>}
  {known&&methods.includes("voice")&&<Button variant="ghost" disabled={busy} onClick={()=>void voice()}><Mic size={16}/>Voice clock {next==="clock_in"?"in":"out"}</Button>}
  {known&&history.length>0&&<div className="border-t border-border pt-4 text-left space-y-2"><h3 className="font-semibold">My worked hours</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="py-2 text-left">Date</th><th>In</th><th>Lunch</th><th>Out</th><th className="text-right">Hours</th></tr></thead><tbody>{history.map(h=><tr key={h.shift_date} className="border-t border-border"><td className="py-3">{h.shift_date}</td><td className="text-center">{h.clock_in?new Date(h.clock_in).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"Missing"}</td><td className="text-center text-xs">{h.lunch_out?`${new Date(h.lunch_out).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}–${h.lunch_in?new Date(h.lunch_in).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"…"}`:"—"}</td><td className="text-center">{h.clock_out?new Date(h.clock_out).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—"}</td><td className="text-right">{h.approved_hours===null?"Pending":Number(h.approved_hours).toFixed(2)}</td></tr>)}</tbody></table></div></div>}
  </>}
  {known&&<ClockReminders schedule={schedule} next={next==="clock_in"?"clock_in":"clock_out"}/>}
  {user&&!pinMode&&known&&<StaffPayCenter/>}
  {!online&&<p role="status" className="flex items-center justify-center gap-2 rounded-md bg-warning/15 text-sm font-medium p-2"><CloudOff size={16}/>No internet — punches are saved on this phone and sent later.</p>}
  {queue.length>0&&<div className="rounded-md border border-warning p-3 text-left text-sm space-y-2"><div className="flex items-center justify-between gap-2"><span className="font-medium">{queue.filter(q=>!q.error).length} punch(es) waiting to send</span><Button size="sm" variant="outline" disabled={!online} onClick={()=>void syncPunches().then(r=>r.sent&&toast.success("Offline punches sent"))}><RefreshCw size={14}/>Send now</Button></div>
   {queue.map(q=><div key={q.id} className="flex items-center justify-between gap-2 border-t border-border pt-2"><span>{DONE[q.direction]} · {new Date(q.captured_at).toLocaleString([],{dateStyle:"short",timeStyle:"short"})}{q.error&&<span className="block text-destructive">Not accepted: {q.error}</span>}</span>{q.error&&<Button size="sm" variant="ghost" onClick={()=>discardPunch(q.id)}>Dismiss</Button>}</div>)}</div>}
  {last&&<p role="status" className="text-success font-medium">{last}</p>}{error&&<p role="alert" className="text-destructive text-sm">{error}</p>}
  <p className="text-xs text-muted-foreground flex justify-center items-center gap-2"><ShieldCheck size={14}/>{online?"Live attendance · Company-protected records":"Offline mode · punches checked by your manager"}</p>
 </section>;
}