import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export default function AcceptInvitationPage(){
 const {user,loading}=useAuth(),navigate=useNavigate();const [password,setPassword]=useState(''),[saving,setSaving]=useState(false);
 const recovery = /type=(invite|recovery|signup)/.test(window.location.hash);
 const save=async()=>{setSaving(true);try{const {error}=await supabase.auth.updateUser({password});if(error)throw error;toast.success('Password saved');navigate('/portal?tab=profile')}catch(e){toast.error(e instanceof Error?e.message:'Unable to save password')}finally{setSaving(false)}};
 return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6"><div className="w-full max-w-md space-y-5"><h1 className="font-display text-2xl">Welcome to your company workspace</h1>{loading?<p>Confirming your invitation…</p>:!user?<><p className="text-muted-foreground">Open the invitation link from your email, or sign in to continue.</p><Button onClick={()=>navigate('/auth')}>Sign in</Button></>:<><label className="text-sm block space-y-2">Set your password<Input aria-label="New password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label><Button disabled={saving||password.length<8||(!recovery&&Boolean(user.email_confirmed_at))} onClick={save}>{saving?'Saving…':'Save password & continue'}</Button><Button variant="outline" onClick={()=>navigate('/portal?tab=profile')}>Complete my staff information</Button></>}</div></main>
}