import { motion } from "framer-motion";
import { Globe, Building, Shield, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ST_LUCIA_CONFIG, formatCurrency } from "@/lib/payroll-engine";

export default function SettingsPage() {
  const config = ST_LUCIA_CONFIG;

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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Building size={16} className="text-primary" />
                Company Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company Name</label>
                <input defaultValue="Promotech Solutions Ltd." className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employer NIC Number</label>
                <input defaultValue="EMP-NIC-2022-001" className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tax ID</label>
                <input defaultValue="TID-LC-00123" className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* OECS Countries */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Globe size={16} className="text-primary" />
                OECS Region Support
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Expandable to other OECS member states:</p>
              <div className="grid grid-cols-2 gap-2">
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
