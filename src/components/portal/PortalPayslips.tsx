import { useEffect, useState } from "react";
import { FileText, Download, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Payslip {
  id: string;
  period: string;
  gross_pay: number;
  basic_pay: number;
  overtime_pay: number;
  employee_nic: number;
  employer_nic: number;
  paye: number;
  total_deductions: number;
  net_pay: number;
  created_at: string;
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PortalPayslips() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Payslip | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchPayslips = async () => {
      const { data } = await supabase
        .from("payslips")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setPayslips(data || []);
      setLoading(false);
    };
    fetchPayslips();
  }, [user]);

  if (loading) {
    return (
      <Card className="shadow-card border-border/60">
        <CardContent className="p-8 text-center text-muted-foreground">Loading payslips...</CardContent>
      </Card>
    );
  }

  if (payslips.length === 0) {
    return (
      <Card className="shadow-card border-border/60">
        <CardContent className="p-12 text-center">
          <FileText size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-display font-semibold text-foreground mb-2">No Payslips Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Your payslips will appear here once your employer processes payroll.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">My Payslips</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Period</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Gross</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Deductions</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Net Pay</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((slip) => (
                <tr key={slip.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{slip.period}</td>
                  <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(slip.gross_pay)}</td>
                  <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(slip.total_deductions)}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-success">{formatCurrency(slip.net_pay)}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelected(slip)}
                      className="p-2 rounded-md hover:bg-secondary transition-colors"
                    >
                      <Eye size={16} className="text-primary" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Payslip — {selected.period}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Earnings</h3>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Basic Salary</span><span className="font-mono text-foreground">{formatCurrency(selected.basic_pay)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Overtime</span><span className="font-mono text-foreground">{formatCurrency(selected.overtime_pay)}</span></div>
                    <div className="flex justify-between font-semibold border-t border-border pt-1.5"><span className="text-foreground">Gross Pay</span><span className="font-mono text-foreground">{formatCurrency(selected.gross_pay)}</span></div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Deductions</h3>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">NIC (5%)</span><span className="font-mono text-destructive">{formatCurrency(selected.employee_nic)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">PAYE</span><span className="font-mono text-destructive">{formatCurrency(selected.paye)}</span></div>
                    <div className="flex justify-between font-semibold border-t border-border pt-1.5"><span className="text-foreground">Total Deductions</span><span className="font-mono text-destructive">{formatCurrency(selected.total_deductions)}</span></div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-success/5 border border-success/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Net Pay</span>
                    <span className="text-2xl font-display font-bold text-success">{formatCurrency(selected.net_pay)} XCD</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
