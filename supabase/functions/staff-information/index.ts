import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { personalSchema } from "../_shared/user-management.ts";
Deno.serve(async req => {
  const reply = (data: unknown, status=200) => new Response(JSON.stringify(data), {status,headers:{...corsHeaders,"Content-Type":"application/json"}});
  if (req.method === "OPTIONS") return reply({});
  try {
    const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url||!anon||!key) throw new Error("Service unavailable");
    const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});
    const {data:{user}}=await client.auth.getUser();
    if (!user) return reply({error:"Sign in required"},401);
    const parsed=personalSchema.safeParse(await req.json());
    if (!parsed.success) return reply({error:parsed.error.issues[0]?.message||"Invalid personal information"},400);
    const admin=createClient(url,key,{auth:{persistSession:false}});
    const {error}=await admin.rpc("save_own_staff_information",{_user:user.id,_details:parsed.data});
    if(error) throw error;
    return reply({success:true});
  }catch(error){return reply({error:error instanceof Error?error.message:"Unable to save personal information"},400);}
});