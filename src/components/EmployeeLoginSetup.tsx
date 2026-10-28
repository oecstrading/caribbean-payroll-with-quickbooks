import { useEffect, useState } from "react";
import { KeyRound, Mail, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { employeeLoginSchema, emptyEmployeeLogin, type EmployeeLogin } from "@/lib/employee-login";
import type { EmployeeFolder, EmployeeForm } from "@/lib/employee-folder";
import { toast } from "sonner";

export default function EmployeeLoginSetup({ folder, creating, details, login, onChange, canManage, onSaved }: {
  folder: EmployeeFolder | null; creating: boolean; details: EmployeeForm; login: EmployeeLogin;
  onChange: (v: EmployeeLogin) => void; canManage: boolean; onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(creating);
  const [error, setError] = useState("");
  const accountId = folder?.accountLinked ? folder.id : folder?.loginUserId;
  useEffect(() => {
    let cancelled = false;
    setError(""); setReady(creating || !accountId);
    if (!accountId) return;
    void supabase.from("profiles").select("email,login_username").eq("user_id", accountId).single().then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setError("Login details could not be loaded. Reopen the folder to retry."); return; }
      onChange({ enabled: true, email: data.email.endsWith("@pin.invalid") ? "" : data.email, username: data.login_username || "", pin: "" }); setReady(true);
    });
    return () => { cancelled = true; };
  }, [accountId, creating]);
  const save = async (resend = false) => {
    if (!folder || !canManage || !ready) return;
    const parsed = accountId ? employeeLoginSchema.safeParse({ ...login, enabled: false }) : employeeLoginSchema.safeParse({ ...login, enabled: true });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message || "Check login details"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", { body: {
        action: resend ? "resend" : accountId ? "update" : "create", user_id: accountId || undefined,
        employee_id: !accountId && folder.accountLinked === false ? folder.id : undefined,
        ...parsed.data, first_name: details.first_name, last_name: details.last_name, phone: details.phone,
        department: details.department, job_title: details.job_title, role: "employee", is_employee: folder.accountLinked === true,
      } });
      let message = data?.error;
      if (error?.context instanceof Response) message = (await error.context.json().catch(() => null))?.error || message;
      if (error || message) throw new Error(message || "Login could not be saved");
      onChange({ ...login, pin: "" }); await onSaved();
      toast.success(data.warning || (data.invitation_sent ? "Login saved; email sent" : "Login saved"));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to save login"); }
    finally { setBusy(false); }
  };
  const disabled = !canManage || busy || !ready;
  return <section className="space-y-5" aria-label="Employee login setup">
    <h3 className="font-display font-semibold flex items-center gap-2"><KeyRound size={18} />Login & invitation</h3>
    {creating && <Label className="flex items-center justify-between min-h-11 gap-3">Give this employee a sign-in account<Switch checked={login.enabled} disabled={!canManage} onCheckedChange={enabled => onChange({ ...login, enabled })} /></Label>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {(!creating || login.enabled) && <>
      <div className="grid sm:grid-cols-2 gap-4">
        {([["email", "Login email", "email"], ["username", "PIN login username", "text"], ["pin", accountId ? "New login PIN (optional)" : "Login PIN (4–6 digits)", "password"]] as const).map(([key, label, type]) => <div key={key} className="space-y-2"><Label htmlFor={`employee-login-${key}`}>{label}</Label><Input id={`employee-login-${key}`} aria-label={label} type={type} value={login[key]} disabled={disabled} autoComplete={key === "pin" ? "new-password" : "off"} maxLength={key === "pin" ? 6 : key === "email" ? 255 : 40} inputMode={key === "pin" ? "numeric" : undefined} onChange={e => onChange({ ...login, [key]: key === "pin" ? e.target.value.replace(/\D/g, "") : e.target.value })} /></div>)}
        <div className="space-y-2"><Label>Password</Label><p className="text-sm text-muted-foreground">The employee sets their private password through the email invitation or password-reset link. Existing passwords and PINs are never displayed.</p></div>
      </div>
      {!creating && <div className="flex flex-wrap gap-2"><Button disabled={disabled} onClick={() => void save()}><Save size={16} />{busy ? "Saving…" : accountId ? "Save login details" : login.email ? "Create login & send invitation" : "Create PIN login"}</Button>{accountId && <Button variant="outline" disabled={disabled || !login.email} onClick={() => void save(true)}><Mail size={16} />Send invitation / password reset</Button>}</div>}
    </>}
  </section>;
}