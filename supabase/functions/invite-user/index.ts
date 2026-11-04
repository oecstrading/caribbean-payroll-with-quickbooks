import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import bcrypt from "npm:bcryptjs@2.4.3";
import { accountSchema, mayManageAccount } from "../_shared/user-management.ts";

Deno.serve(async req => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return reply({});
  try {
    const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !service || !anon) throw new Error("Account service unavailable");
    const callerClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return reply({ error: "Sign in required" }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const [{ data: role }, { data: org }] = await Promise.all([admin.from("user_roles").select("role").eq("user_id", caller.id).single(), callerClient.rpc("current_org_id")]);
    if (role?.role !== "admin" || !org) return reply({ error: "Company administrator required" }, 403);
    const parsed = accountSchema.safeParse(await req.json());
    if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message || "Invalid account details" }, 400);
    const v = parsed.data;
    const { data: authority } = await callerClient.rpc("administrator_authority", { _user: caller.id });
    const companySuper = authority?.company_super_admin === true;
    const platformSuper = authority?.platform_super_admin === true;
    let id = v.user_id;
    let created = false;
    let invitationSent = false;
    let employment: Record<string, unknown> | null = null;
    if (v.employee_id) {
      if (!await callerClient.rpc("has_workspace_access", { _user_id: caller.id, _module: "hr" }).then(r => r.data === true)) return reply({ error: "HR access required" }, 403);
      const { data: employee, error } = await admin.from("employee_records").select("*").eq("user_id", v.employee_id).eq("org_id", org).is("deleted_at", null).is("permanently_deleted_at", null).is("login_user_id", null).maybeSingle();
      if (error || !employee) return reply({ error: "Employee already linked or unavailable" }, 400);
      employment = employee;
    }
    // Use the stable published origin, not an arbitrary request-controlled redirect.
    const redirectTo = "https://caribbean-payroll-with-quickbooks.lovable.app/accept-invitation";
    if (v.action !== "create") {
      const { data: target } = await admin.from("profiles").select("org_id,email,login_username,deleted_at").eq("user_id", id).single();
      const [{ data: targetRole }, { data: targetAuthority }] = await Promise.all([admin.from("user_roles").select("role").eq("user_id", id).single(), callerClient.rpc("administrator_authority", { _user: id })]);
      if (!target || target.deleted_at || !mayManageAccount(role.role, target.org_id === org, targetRole?.role === "admin" && id !== caller.id, companySuper, targetAuthority?.platform_super_admin === true && id !== caller.id, platformSuper)) return reply({ error: "You cannot manage this account" }, 403);
      if (v.action === "resend") {
        if (!target.email || target.email.endsWith("@pin.invalid")) return reply({ error: "Add a real email address first" }, 400);
        const { data: authTarget } = await admin.auth.admin.getUserById(id);
        const publicAuth = createClient(url, anon, { auth: { persistSession: false } });
        const result = authTarget.user?.email_confirmed_at
          ? await publicAuth.auth.resetPasswordForEmail(target.email, { redirectTo })
          : await publicAuth.auth.resend({ type: "signup", email: target.email, options: { emailRedirectTo: redirectTo } });
        if (result.error) throw result.error;
        return reply({ success: true, invitation_sent: true });
      }
      if (!v.email && !target.email?.endsWith("@pin.invalid")) return reply({ error: "An existing email login cannot be removed here" }, 400);
      if (v.email && v.email !== target.email) {
        if (id === caller.id) return reply({ error: "Use account settings to change your own sign-in email" }, 400);
        const { error } = await admin.auth.admin.updateUserById(id, { email: v.email, email_confirm: false });
        if (error) throw error;
      }
    } else {
      if (v.role === "admin" && !companySuper) return reply({ error: "Company super administrator required to add administrators" }, 403);
      // Same person already has a login (same email or username): give them access to this company instead of a second account.
      const matches = [];
      if (v.email) matches.push(...((await admin.from("profiles").select("user_id,org_id,deleted_at").ilike("email", v.email)).data ?? []));
      if (v.username) matches.push(...((await admin.from("profiles").select("user_id,org_id,deleted_at").eq("login_username", v.username)).data ?? []));
      const existing = matches.find(m => !m.deleted_at && m.user_id);
      if (existing) {
        if (existing.org_id === org) return reply({ error: "This person already has a login in this company. Edit their existing user instead." }, 400);
        if (!platformSuper) return reply({ error: "This person already has a login for another company. Ask the platform super admin to give them access to this company (My Companies → Assign companies)." }, 403);
        const { data: existingRole } = await admin.from("user_roles").select("role").eq("user_id", existing.user_id).maybeSingle();
        if (existingRole?.role !== "admin" && existingRole?.role !== "manager") return reply({ error: "This login belongs to an employee in another company. Only administrators and managers can share one login across companies." }, 400);
        const { error: grantError } = await admin.from("company_admin_access").upsert({ user_id: existing.user_id, org_id: org, granted_by: caller.id }, { onConflict: "user_id,org_id" });
        if (grantError) throw grantError;
        return reply({ success: true, user_id: existing.user_id, shared_access: true, invitation_sent: false });
      }
      const result = v.email
        ? await admin.auth.admin.inviteUserByEmail(v.email, { redirectTo, data: { first_name: v.first_name, last_name: v.last_name } })
        : await admin.auth.admin.createUser({ email: `${crypto.randomUUID()}@pin.invalid`, password: crypto.randomUUID() + "aA1!", email_confirm: true, user_metadata: { first_name: v.first_name, last_name: v.last_name } });
      if (result.error || !result.data.user) throw result.error || new Error("Account creation failed");
      id = result.data.user.id; created = true; invitationSent = Boolean(v.email);
      const { data: existingProfile } = await admin.from("profiles").select("org_id").eq("user_id", id).single();
      if (existingProfile?.org_id) return reply({ error: "This account already belongs to a company. Edit its existing user instead." }, 400);
      const { error } = await admin.rpc("create_invited_profile", { _user_id: id, _org_id: org, _email: v.email, _first: v.first_name, _last: v.last_name, _role: v.role });
      if (error) { await admin.auth.admin.deleteUser(id); throw error; }
    }
    if (!id) throw new Error("Select an account");
    const update: Record<string, unknown> = { first_name: v.first_name, last_name: v.last_name, phone: v.phone, department: v.department, job_title: v.job_title, is_employee: employment ? false : v.is_employee, login_username: v.username || null };
    if (employment) update.hr_details = employment.hr_details;
    if (v.email) update.email = v.email;
    const { error: profileError } = await admin.from("profiles").update(update).eq("user_id", id).eq("org_id", org);
    if (profileError) { if (created) await admin.auth.admin.deleteUser(id); throw profileError; }
    if (employment && v.employee_id) {
      const { error } = await admin.rpc("link_employee_login", { _actor: caller.id, _employee: v.employee_id, _user: id });
      if (error) { if (created) await admin.auth.admin.deleteUser(id); throw error; }
    }
    if (v.pin) {
      const { error } = await admin.from("user_pins").upsert({ user_id: id, org_id: org, pin_hash: await bcrypt.hash(v.pin, 12), is_enabled: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
      await admin.from("user_pin_attempts").delete().eq("user_id", id);
    }
    if (!created && v.email) {
      const { data: authTarget } = await admin.auth.admin.getUserById(id);
      if (!authTarget.user?.email_confirmed_at) {
        const publicAuth = createClient(url, anon, { auth: { persistSession: false } });
        const { error } = await publicAuth.auth.resend({ type: "signup", email: v.email, options: { emailRedirectTo: redirectTo } });
        if (error) return reply({ success: true, user_id: id, invitation_sent: false, warning: "Account saved, but verification email could not be sent. Use Send invitation to retry." });
        invitationSent = true;
      }
    }
    return reply({ success: true, user_id: id, invitation_sent: invitationSent });
  } catch (error) {
    const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
    console.error("invite-user failed", error);
    return reply({ error: message || "Account operation failed" }, 400);
  }
});