import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, MapPin, AlertTriangle, Clock, CheckCircle, LogIn } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface SiteData {
  site: any;
  patrols: any[];
  incidents: any[];
  signoffs: any[];
}

export default function ClientPortalPage() {
  const [accessCode, setAccessCode] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!accessCode.trim()) { setError("Enter your access code"); return; }
    setLoading(true);
    setError("");

    const { data, error: rpcErr } = await supabase.rpc("client_portal_data", { _code: accessCode.trim() });
    const portal = data as any;
    if (rpcErr || !portal) {
      setError("Invalid or expired access code");
      setLoading(false);
      return;
    }
    setSiteData({
      site: portal.site,
      patrols: portal.patrols || [],
      incidents: portal.incidents || [],
      signoffs: portal.signoffs || [],
    });
    setAuthenticated(true);
    setLoading(false);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <Card className="shadow-card border-border/60">
            <CardHeader className="text-center pb-2">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Shield size={28} className="text-primary" />
              </div>
              <CardTitle className="text-xl font-display">Client Portal</CardTitle>
              <p className="text-sm text-muted-foreground">Enter your site access code to view patrol activity</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Access Code"
                value={accessCode}
                onChange={e => setAccessCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className="text-center text-lg tracking-widest"
              />
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <LogIn size={16} />
                {loading ? "Verifying..." : "View My Site"}
              </button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!siteData) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{siteData.site?.name}</h1>
            <p className="text-sm text-muted-foreground">{siteData.site?.address}</p>
          </div>
          <button onClick={() => { setAuthenticated(false); setSiteData(null); setAccessCode(""); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Log out
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-card border-border/60">
            <CardContent className="p-4 text-center">
              <MapPin size={20} className="mx-auto text-primary mb-1" />
              <p className="text-2xl font-display font-bold">{siteData.patrols.length}</p>
              <p className="text-xs text-muted-foreground">Patrol Logs</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border/60">
            <CardContent className="p-4 text-center">
              <AlertTriangle size={20} className="mx-auto text-amber-500 mb-1" />
              <p className="text-2xl font-display font-bold">{siteData.incidents.length}</p>
              <p className="text-xs text-muted-foreground">Incidents</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border/60">
            <CardContent className="p-4 text-center">
              <CheckCircle size={20} className="mx-auto text-emerald-500 mb-1" />
              <p className="text-2xl font-display font-bold">{siteData.signoffs.length}</p>
              <p className="text-xs text-muted-foreground">Sign-offs</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Patrols */}
        <Card className="shadow-card border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <MapPin size={16} className="text-primary" /> Recent Patrol Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {siteData.patrols.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No patrol logs yet</p>
            ) : (
              <div className="space-y-2">
                {siteData.patrols.slice(0, 10).map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                    <div>
                      <p className="text-sm font-medium">{log.checkpoint_name || "Patrol scan"}</p>
                      {log.notes && <p className="text-xs text-muted-foreground">{log.notes}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(log.scanned_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Incidents */}
        <Card className="shadow-card border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" /> Incident Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {siteData.incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No incidents reported</p>
            ) : (
              <div className="space-y-2">
                {siteData.incidents.map((inc: any) => (
                  <div key={inc.id} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{inc.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{inc.description}</p>
                      </div>
                      <Badge variant={inc.severity === "critical" || inc.severity === "high" ? "destructive" : "secondary"}>{inc.severity}</Badge>
                    </div>
                    {inc.photo_urls?.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {inc.photo_urls.map((url: string, i: number) => (
                          <img key={i} src={url} alt="evidence" className="w-16 h-16 object-cover rounded border" />
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(inc.reported_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
