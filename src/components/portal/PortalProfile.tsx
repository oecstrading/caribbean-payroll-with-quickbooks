import { useEffect, useState } from "react";
import { User, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function PortalProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    department: "",
    job_title: "",
    nic_number: "",
    start_date: "",
  });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          phone: data.phone || "",
          department: data.department || "",
          job_title: data.job_title || "",
          nic_number: data.nic_number || "",
          start_date: data.start_date || "",
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
      const { error } = await supabase
        .from("profiles")
        .update({
          phone: profile.phone,
          first_name: profile.first_name,
          last_name: profile.last_name,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Profile updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card className="shadow-card border-border/60"><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>;
  }

  return (
    <Card className="shadow-card border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <User size={16} className="text-primary" />
          My Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">First Name</label>
            <input
              type="text"
              value={profile.first_name}
              onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Name</label>
            <input
              type="text"
              value={profile.last_name}
              onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="758-555-0000"
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</label>
            <input
              type="text"
              value={profile.department}
              disabled
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Title</label>
            <input
              type="text"
              value={profile.job_title}
              disabled
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">NIC Number</label>
            <input
              type="text"
              value={profile.nic_number}
              disabled
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start Date</label>
            <input
              type="text"
              value={profile.start_date ? new Date(profile.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
              disabled
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Fields like department, job title, and NIC number can only be changed by your HR administrator.</p>
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
