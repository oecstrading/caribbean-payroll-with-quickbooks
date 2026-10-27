import { useEffect, useState } from "react";
import { Clock, LogIn, LogOut, Mic, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function StaffTimeClock({ companyId }: { companyId?: string }) {
 const { user }=useAuth(); const [now,setNow]=useState(new Date()); const [code,setCode]=useState(""); const [pin,setPin]=useState(""); const [next,setNext]=useState<"clock_in"|"clock_out">("clock_in"); const [busy,setBusy]=useState(false); const [pinMode,setPinMode]=useState(!!companyId); const [known,setKnown]=useState(false); const [last,setLast]=useState(""); const [error,setError]=useState("");
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
 async function request(action:"status"|"punch", mode="device") {
  const body: Record<string,unknown>={action,mode};
  if(pinMode) { if(!companyId||!code||!/^\d{4,6}$/.test(pin)) throw new Error("Enter your employee code and 4–6 digit PIN"); Object.assign(body,{org_id:companyId,employee_code:code,pin}); }
  if(action==="punch") {
   body.direction=next;
   // Location is optional unless the company's server-side work-site rule requires it.
   const position=await new Promise<GeolocationPosition|null>(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(resolve,()=>resolve(null),{timeout:8000,maximumAge:30000});});
   if(position)Object.assign(body,{latitude:position.coords.latitude,longitude:position.coords.longitude});
  }
  const {data,error}=await supabase.functions.invoke("workforce-clock",{body});
  if(error) { let message=error.message; if(error.context instanceof Response){const detail=await error.context.json().catch(()=>null);message=detail?.error??message;} throw new Error(message); }
  if(data?.error)throw new Error(data.error);
  setNext(data.next);setKnown(true);if(action==="punch"){setLast(`${next==="clock_in"?"Clocked in":"Clocked out"} · ${new Date(data.punched_at).toLocaleTimeString()}`);setPin("");toast.success("Attendance saved");}
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
  {companyId&&user&&<div className="flex gap-2 justify-center"><Button variant={!pinMode?"secondary":"ghost"} onClick={()=>{setPinMode(false);setKnown(false);}}>My account</Button><Button variant={pinMode?"secondary":"ghost"} onClick={()=>{setPinMode(true);setKnown(false);}}>Employee PIN</Button></div>}
  {pinMode&&<div className="text-left space-y-4"><div className="space-y-2"><Label htmlFor="clock-code">Employee code</Label><Input id="clock-code" autoComplete="username" value={code} maxLength={40} onChange={e=>{setCode(e.target.value);setKnown(false);}}/></div><div className="space-y-2"><Label htmlFor="clock-pin">PIN</Label><Input id="clock-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} className="h-14 text-center text-2xl" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}/></div></div>}
  {!user&&!pinMode?<p className="text-muted-foreground">Sign in or use your company's employee clock link.</p>:<Button className="w-full h-16 text-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy} onClick={()=>void submit()}>{next==="clock_in"?<LogIn/>:<LogOut/>}{busy?"Recording…":pinMode&&!known?"Check employee clock":next==="clock_in"?"Clock In":"Clock Out"}</Button>}
  {(user||pinMode&&known)&&<Button variant="ghost" disabled={busy} onClick={()=>void voice()}><Mic size={16}/>Voice clock {next==="clock_in"?"in":"out"}</Button>}
  {last&&<p role="status" className="text-success font-medium">{last}</p>}{error&&<p role="alert" className="text-destructive text-sm">{error}</p>}
  <p className="text-xs text-muted-foreground flex justify-center items-center gap-2"><ShieldCheck size={14}/>Live attendance · Company-protected records</p>
 </section>;
}