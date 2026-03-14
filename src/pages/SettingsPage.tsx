import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Globe, Building, Shield, Phone, Link, FileText, Save, Upload, ImageIcon, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (data) {
        setSettings(data as CompanySettings);
        setForm({
          company_name: data.company_name || "",
          employer_nic_number: data.employer_nic_number || "",
          tax_id: data.tax_id || "",
          vat_number: data.vat_number || "",
          telephone: data.telephone || "",
          website: data.website || "",
          address: data.address || "",
        });
      }
      setLoading(false);
    };
    fetch();
  }, []);

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

  const inputClass = "w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20";

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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
