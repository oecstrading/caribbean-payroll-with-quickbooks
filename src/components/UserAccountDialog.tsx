import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

export interface AccountDetails { user_id: string; first_name: string; last_name: string; email: string; phone: string; department: string; job_title: string; role: "admin"|"manager"|"employee"; login_username?: string | null; is_employee?: boolean }
const initial = {first_name:"",last_name:"",email:"",username:"",phone:"",department:"",job_title:"",role:"manager",is_employee:false,pin:""};
export default function UserAccountDialog({open,user,canAddAdmin,onClose,onSaved}:{open:boolean;user:AccountDetails|null;canAddAdmin:boolean;onClose:()=>void;onSaved:()=>void}) {
  const [form,setForm]=useState(initial),[saving,setSaving]=useState(false);
  useEffect(()=>{setForm(user?{...initial,...user,email:user.email.endsWith("@pin.invalid")?"":user.email,username:user.login_username||"",is_employee:user.is_employee??true}:initial)},[user,open]);
  const save=async()=>{
    if(form.email&&!z.string().email().safeParse(form.email).success){toast.error("Enter a valid email");return;}
    if(!form.email&&(!form.username||(!user&&!/^\d{4,6}$/.test(form.pin)))){toast.error("Enter an email or a username and PIN");return;}
    setSaving(true);
    try{
      const {data,error}=await supabase.functions.invoke("invite-user",{body:{...form,action:user?"update":"create",user_id:user?.user_id}});
      let detail=data?.error;
      if(error){try{detail=detail||(await error.context.json()).error}catch{/* fallback */}}
      if(error||detail)throw new Error(detail||"Account could not be saved");
      toast.success(data.shared_access?"This person already has a login, so they can now open this company with the same email, username and password":data.warning|| (data.invitation_sent?"Account saved; invitation sent":"Account saved"));onSaved();onClose();
    }catch(error){toast.error(error instanceof Error?error.message:"Unable to save account")}finally{setSaving(false)}
  };
  return <Dialog open={open} onOpenChange={v=>!v&&!saving&&onClose()}><DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{user?"Edit user & login":"Add user"}</DialogTitle></DialogHeader>
    <div className="grid sm:grid-cols-2 gap-4">{([['first_name','First name'],['last_name','Last name'],['email','Login email'],['username','PIN login username'],['phone','Phone'],['department','Department'],['job_title','Job title'],['pin',user?'New PIN (optional)':'PIN (optional with email)']] as const).map(([key,label])=><label key={key} className="space-y-1.5 text-sm">{label}<Input aria-label={label} value={form[key]} type={key==='pin'?'password':key==='email'?'email':'text'} autoComplete={key==='pin'?'new-password':'off'} maxLength={key==='pin'?6:key==='email'?255:100} onChange={e=>setForm({...form,[key]:key==='pin'?e.target.value.replace(/\D/g,''):e.target.value})}/></label>)}
      <label className="space-y-1.5 text-sm">Workspace role<NativeSelect aria-label="Workspace role" value={form.role} disabled={!!user} onChange={e=>setForm({...form,role:e.target.value})}><option value="employee">Staff self-service</option><option value="manager">Manager</option>{(canAddAdmin||user?.role==='admin')&&<option value="admin">Administrator</option>}</NativeSelect></label>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.is_employee} onCheckedChange={v=>setForm({...form,is_employee:v===true})}/>Also a company employee</label>
    </div><p className="text-xs text-muted-foreground">PIN-only access uses the assigned username. Email invitations and email password recovery need a real email address.</p>
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={save}>{saving?'Saving…':user?'Save user & login':form.email?'Add & send invitation':'Add PIN user'}</Button></div>
  </DialogContent></Dialog>;
}