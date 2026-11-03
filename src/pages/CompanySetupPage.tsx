import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CompanySetupFields from "@/components/CompanySetupFields";
import { companySetupSchema, companySaveError, emptyCompanySetup, setupToken, type CompanySetup } from "@/lib/company-setup";
import { companyAction } from "@/lib/company-api";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import caribbeanHero from "@/assets/caribbean-hero.jpg";

const storageKey = "company-setup-invite";
export default function CompanySetupPage() {
  const { user, loading, signOut } = useAuth();
  const { refreshAccess } = useRole();
  const navigate = useNavigate();
  const [token] = useState(() => { const incoming = setupToken(window.location.hash); if (incoming) sessionStorage.setItem(storageKey, incoming); return incoming || sessionStorage.getItem(storageKey) || ""; });
  const [form, setForm] = useState<CompanySetup>(emptyCompanySetup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user || !token) return;
    let cancelled = false;
    setReady(false); setError("");
    companyAction({ action: "inspect", token }).then(data => { if (!cancelled) { setForm({ ...emptyCompanySetup, ...data.details, email: user.email ?? "" }); setReady(true); } }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [user?.id, token]);
  async function authenticate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/company-setup` } });
        if (error) throw error;
        if (!data.session) toast.success("Confirm your email, then reopen your company setup link.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Sign-in failed"); }
    finally { setBusy(false); }
  }
  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/company-setup` });
    if (result.error) toast.error("Google sign-in failed. Please try again.");
  }
  async function complete(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const details = companySetupSchema.parse(form);
      await companyAction({ action: "complete", token, details });
      sessionStorage.removeItem(storageKey);
      await refreshAccess();
      // A full navigation refreshes every company-scoped provider and query cache.
      window.location.replace("/settings");
    } catch (err) { toast.error(companySaveError(err)); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-background text-foreground">
    <header className="relative overflow-hidden h-48 sm:h-56"><img src={caribbeanHero} alt="Saint Lucia coastline" className="absolute inset-0 w-full h-full object-cover" /><div className="absolute inset-0 bg-foreground/70" /><div className="relative max-w-3xl mx-auto px-6 py-10 text-primary-foreground"><Building2 size={30} /><h1 className="text-3xl font-display font-bold mt-4">Company setup</h1><p className="mt-2">OECS HR & Payroll</p></div></header>
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {loading ? <p>Loading your account…</p> : !token ? <div className="space-y-4"><h2 className="text-xl font-display">Company invitation required</h2><p className="text-muted-foreground">Open the setup link sent by your platform administrator. If you confirmed your email in another browser, reopen that original link here.</p><Button onClick={() => navigate("/auth")}>Go to sign in</Button></div> : !user ? <div className="max-w-md space-y-5"><h2 className="text-xl font-display font-semibold">{signup ? "Create your administrator account" : "Sign in to set up your company"}</h2><p className="text-sm text-muted-foreground">Use the email address your invitation was issued to.</p><Button className="w-full" variant="outline" onClick={() => void google()}>Continue with Google</Button><form onSubmit={authenticate} className="space-y-4"><div className="space-y-2"><Label htmlFor="customer-email">Email</Label><Input id="customer-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="customer-password">Password</Label><Input id="customer-password" type="password" required minLength={signup ? 8 : 1} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} /></div><Button disabled={busy} type="submit" className="w-full">{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</Button></form><Button variant="link" onClick={() => setSignup(!signup)}>{signup ? "Already have an account? Sign in" : "New customer? Create account"}</Button></div> : error ? <div role="alert" className="space-y-4"><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => void signOut()}>Sign out to use another account</Button></div> : !ready ? <p>Checking your invitation…</p> : <form onSubmit={complete} className="space-y-6"><div className="flex items-center gap-3 border-b border-border pb-4"><ShieldCheck className="text-primary" /><div><h2 className="text-xl font-display font-semibold">Configure your company</h2><p className="text-sm text-muted-foreground break-all">{user.email}</p></div></div><CompanySetupFields value={form} onChange={setForm} emailLocked /><div className="flex justify-between gap-3"><Button type="button" variant="outline" onClick={() => void signOut()}>Sign out</Button><Button disabled={busy} type="submit">{busy ? "Creating company…" : "Activate company"}<ArrowRight size={16} className="ml-2" /></Button></div></form>}
    </div>
  </main>;
}