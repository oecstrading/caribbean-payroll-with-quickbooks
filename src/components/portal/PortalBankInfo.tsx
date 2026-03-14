import { useEffect, useState } from "react";
import { CreditCard, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function PortalBankInfo() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bank_name: "",
    branch: "",
    account_number: "",
    account_type: "Savings",
    routing_number: "",
  });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("employee_bank_info")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setForm({
          bank_name: data.bank_name || "",
          branch: data.branch || "",
          account_number: data.account_number || "",
          account_type: data.account_type || "Savings",
          routing_number: data.routing_number || "",
        });
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Try upsert
      const { error } = await supabase
        .from("employee_bank_info")
        .upsert(
          { user_id: user.id, ...form },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      toast.success("Bank information updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-card border-border/60">
        <CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  const fields = [
    { key: "bank_name", label: "Bank Name", placeholder: "e.g., Bank of Saint Lucia" },
    { key: "branch", label: "Branch", placeholder: "e.g., Castries Main" },
    { key: "account_number", label: "Account Number", placeholder: "Enter account number" },
    { key: "routing_number", label: "Routing / Transit No.", placeholder: "Enter routing number" },
  ] as const;

  return (
    <Card className="shadow-card border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <CreditCard size={16} className="text-primary" />
          Bank Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your bank details are used for direct deposit of your salary. Changes are saved securely.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account Type</label>
            <select
              value={form.account_type}
              onChange={(e) => setForm({ ...form, account_type: e.target.value })}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="Savings">Savings</option>
              <option value="Checking">Checking</option>
              <option value="Current">Current</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
