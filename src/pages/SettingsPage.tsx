import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Globe, Building, Shield, Phone, Link, FileText, Save, Upload, ImageIcon, Trash2, Bell, BellOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ST_LUCIA_CONFIG, formatCurrency } from "@/lib/payroll-engine";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CompanySettings {
  id: string;
  company_name: string;
  employer_nic_number: string;
  tax_id: string;
  vat_number: string;
  telephone: string;
  website: string;
  address: string;
  logo_url: string;
}

const defaultSettings: Omit<CompanySettings, "id"> = {
  company_name: "",
  employer_nic_number: "",
  tax_id: "",
  vat_number: "",
  telephone: "",
  website: "",
  address: "",
  logo_url: "",
};

export default function SettingsPage() {
  const config = ST_LUCIA_CONFIG;
  const { isAdmin, isAdminOrManager } = useRole();
  const { user } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [form, setForm] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification settings
  const [notifSettings, setNotifSettings] = useState({
    enable_push: true,
    enable_email: false,
    alert_on_geofence_violation: true,
    alert_on_late_clock_in: true,
    alert_on_panic_button: true,
  });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (data) {
        setSettings(data as CompanySettings);
        setLogoUrl(data.logo_url || "");
        setForm({
          company_name: data.company_name || "",
          employer_nic_number: data.employer_nic_number || "",
          tax_id: data.tax_id || "",
          vat_number: data.vat_number || "",
          telephone: data.telephone || "",
          website: data.website || "",
          address: data.address || "",
          logo_url: data.logo_url || "",
        });
      }
      setLoading(false);
    };
    fetch();
  }, []);

  // Fetch notification settings
  useEffect(() => {
    const fetchNotif = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setNotifSettings({
          enable_push: data.enable_push ?? true,
          enable_email: data.enable_email ?? false,
          alert_on_geofence_violation: data.alert_on_geofence_violation ?? true,
          alert_on_late_clock_in: data.alert_on_late_clock_in ?? true,
          alert_on_panic_button: data.alert_on_panic_button ?? true,
        });
      }
      setNotifLoading(false);
    };
    fetchNotif();
  }, [user]);

  const handleNotifToggle = async (field: string, value: boolean) => {
    if (!user) return;
    const updated = { ...notifSettings, [field]: value };
    setNotifSettings(updated);
    setNotifSaving(true);
    try {
      const { error } = await supabase
        .from("notification_settings")
        .upsert({ user_id: user.id, ...updated, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Notification preference updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
      setNotifSettings({ ...notifSettings, [field]: !value }); // revert
    } finally {
      setNotifSaving(false);
    }
  };

  const handleSave = async () => {
    if (!isAdminOrManager || !user) {
      toast.error("Only admins and managers can update company settings");
      return;
    }
    setSaving(true);
    try {
      if (settings?.id) {
        const { error } = await supabase
          .from("company_settings")
          .update({ ...form, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_settings")
          .insert({ ...form, updated_by: user.id });
        if (error) throw error;
      }
      toast.success("Company settings saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings?.id || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("File must be under 5MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `logo-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("company-assets").upload(filePath, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(filePath);
      const newUrl = urlData.publicUrl;
      const { error: updateErr } = await supabase.from("company_settings").update({ logo_url: newUrl, updated_by: user.id }).eq("id", settings.id);
      if (updateErr) throw updateErr;
      setLogoUrl(newUrl);
      setForm({ ...form, logo_url: newUrl });
      toast.success("Logo uploaded successfully");
    } catch (err: any) { toast.error(err.message || "Failed to upload logo"); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleRemoveLogo = async () => {
    if (!settings?.id || !user) return;
    try {
      await supabase.from("company_settings").update({ logo_url: "", updated_by: user.id }).eq("id", settings.id);
      setLogoUrl("");
      setForm({ ...form, logo_url: "" });
      toast.success("Logo removed");
    } catch (err: any) { toast.error(err.message || "Failed to remove logo"); }
  };

  const inputClass = "w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20";

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your HR & Payroll platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Country Configuration */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="shadow-card border-border/60 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Globe size={16} className="text-primary" />
                Country Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Country</span>
                <span className="text-sm font-medium text-foreground">🇱🇨 {config.countryName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Currency</span>
                <span className="text-sm font-medium text-foreground">{config.currency} ({config.currencySymbol})</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">NIC Rate</span>
                <span className="text-sm font-medium text-foreground">{config.nic.employeeRate * 100}% / {config.nic.employerRate * 100}%</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">NIC Ceiling</span>
                <span className="text-sm font-medium text-foreground">{formatCurrency(config.nic.monthlyCeiling)}/month</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Personal Allowance</span>
                <span className="text-sm font-medium text-foreground">{formatCurrency(config.paye.annualAllowance)}/year</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-muted-foreground">Min Wage</span>
                <span className="text-sm font-medium text-foreground">{formatCurrency(config.minimumWage.hourly)}/hr</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tax Brackets */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="shadow-card border-border/60 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                PAYE Tax Brackets (Annual)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {config.paye.brackets.map((bracket, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(bracket.min)} – {bracket.max === Infinity ? "Above" : formatCurrency(bracket.max)}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{bracket.rate * 100}%</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2">
                Based on 2025 Inland Revenue Department rates for Saint Lucia
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Company Profile */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="md:col-span-2">
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Building size={16} className="text-primary" />
                Company Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-4">Loading...</p>
              ) : (
                <div className="space-y-6">
                  {/* Logo Upload */}
                  <div className="flex items-center gap-6 pb-4 border-b border-border/50">
                    <div className="relative group">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Company logo"
                          className="w-20 h-20 rounded-xl object-contain bg-secondary border border-border/50 p-1"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-secondary border-2 border-dashed border-border flex items-center justify-center">
                          <ImageIcon size={24} className="text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Company Logo</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Max 5MB.</p>
                      {isAdminOrManager && (
                        <div className="flex gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            <Upload size={12} />
                            {uploading ? "Uploading..." : "Upload"}
                          </button>
                          {logoUrl && (
                            <button
                              onClick={handleRemoveLogo}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/20 transition-colors"
                            >
                              <Trash2 size={12} />
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company Name</label>
                    <input value={form.company_name} onChange={update("company_name")} disabled={!isAdminOrManager} placeholder="Enter company name" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employer NIC Number</label>
                    <input value={form.employer_nic_number} onChange={update("employer_nic_number")} disabled={!isAdminOrManager} placeholder="e.g. EMP-NIC-2022-001" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tax ID</label>
                    <input value={form.tax_id} onChange={update("tax_id")} disabled={!isAdminOrManager} placeholder="e.g. TID-LC-00123" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <FileText size={12} />
                      VAT Number
                    </label>
                    <input value={form.vat_number} onChange={update("vat_number")} disabled={!isAdminOrManager} placeholder="e.g. VAT-LC-00456" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Phone size={12} />
                      Telephone
                    </label>
                    <input value={form.telephone} onChange={update("telephone")} disabled={!isAdminOrManager} placeholder="e.g. +1 (758) 123-4567" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Link size={12} />
                      Website
                    </label>
                    <input value={form.website} onChange={update("website")} disabled={!isAdminOrManager} placeholder="e.g. https://www.company.com" className={inputClass} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</label>
                    <input value={form.address} onChange={update("address")} disabled={!isAdminOrManager} placeholder="e.g. 123 Bridge St, Castries, Saint Lucia" className={inputClass} />
                  </div>
                  {isAdminOrManager && (
                    <div className="md:col-span-2 flex justify-end pt-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        <Save size={14} />
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* OECS Countries */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="md:col-span-2">
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Globe size={16} className="text-primary" />
                OECS Region Support
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Expandable to other OECS member states:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { flag: "🇱🇨", name: "Saint Lucia", active: true },
                  { flag: "🇬🇩", name: "Grenada", active: false },
                  { flag: "🇩🇲", name: "Dominica", active: false },
                  { flag: "🇦🇬", name: "Antigua & Barbuda", active: false },
                  { flag: "🇰🇳", name: "St. Kitts & Nevis", active: false },
                  { flag: "🇻🇨", name: "St. Vincent", active: false },
                ].map((country) => (
                  <div
                    key={country.name}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                      country.active
                        ? "bg-primary/10 border border-primary/20 text-foreground font-medium"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <span>{country.flag}</span>
                    <span className="text-xs">{country.name}</span>
                    {country.active && <span className="ml-auto text-[10px] text-primary font-bold">ACTIVE</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
