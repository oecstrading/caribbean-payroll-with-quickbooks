import { useState } from "react";
import { motion } from "framer-motion";
import { Search, UserPlus, MoreHorizontal, Mail, Phone, FileText, X, Upload } from "lucide-react";
import CSVImportDialog from "@/components/CSVImportDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sampleEmployees, type Employee } from "@/lib/sample-data";
import { formatCurrency, calculatePayroll, ST_LUCIA_CONFIG } from "@/lib/payroll-engine";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("All");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showImport, setShowImport] = useState(false);
  const navigate = useNavigate();

  const departments = ["All", ...new Set(sampleEmployees.map((e) => e.department))];

  const filtered = sampleEmployees.filter((e) => {
    const matchSearch = `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDept === "All" || e.department === filterDept;
    return matchSearch && matchDept;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">{sampleEmployees.length} team members</p>
          <p className="text-xs text-muted-foreground mt-1">Sample records • Smiley's Tinting Services, Saint Lucia • Fictional staff and salaries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            <Upload size={16} />
            Import CSV
          </button>
          <button
            onClick={() => navigate("/users")}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus size={16} />
            Add Employee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setFilterDept(dept)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                filterDept === dept
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-muted"
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Employee Table */}
      <Card className="shadow-card border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Department</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Job Title</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">NIC No.</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Salary</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((employee, i) => (
                <motion.tr
                  key={employee.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedEmployee(employee)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {employee.firstName[0]}{employee.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{employee.firstName} {employee.lastName}</p>
                        <p className="text-xs text-muted-foreground">{employee.email}</p>
                        {employee.companyName && <p className="text-xs text-primary">{employee.companyName}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-foreground">{employee.department}</td>
                  <td className="py-3 px-4 text-foreground">{employee.jobTitle}</td>
                  <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{employee.nicNumber}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{formatCurrency(employee.monthlySalary)} <span className="text-xs text-muted-foreground">XCD</span></td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={employee.status === "Active" ? "default" : "secondary"}
                      className={employee.status === "Active" ? "bg-success/10 text-success border-success/20 hover:bg-success/20" : ""}
                    >
                      {employee.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                      <MoreHorizontal size={16} className="text-muted-foreground" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Employee Detail Dialog */}
      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedEmployee && (() => {
            const payroll = calculatePayroll(selectedEmployee.monthlySalary, ST_LUCIA_CONFIG);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}
                      </span>
                    </div>
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Department</p>
                      <p className="font-medium text-foreground">{selectedEmployee.department}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Job Title</p>
                      <p className="font-medium text-foreground">{selectedEmployee.jobTitle}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Email</p>
                      <p className="font-medium text-foreground">{selectedEmployee.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Phone</p>
                      <p className="font-medium text-foreground">{selectedEmployee.phone}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">NIC Number</p>
                      <p className="font-mono text-foreground">{selectedEmployee.nicNumber}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Start Date</p>
                      <p className="font-medium text-foreground">{new Date(selectedEmployee.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Monthly Pay Summary</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-secondary text-center">
                        <p className="text-xs text-muted-foreground">Gross</p>
                        <p className="font-display font-bold text-foreground">{formatCurrency(payroll.grossMonthly)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-destructive/5 text-center">
                        <p className="text-xs text-muted-foreground">Deductions</p>
                        <p className="font-display font-bold text-destructive">{formatCurrency(payroll.totalDeductions)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-success/5 text-center">
                        <p className="text-xs text-muted-foreground">Net Pay</p>
                        <p className="font-display font-bold text-success">{formatCurrency(payroll.netPay)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        setSelectedEmployee(null);
                        navigate(`/payslips?employee=${selectedEmployee.id}`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      <FileText size={16} />
                      View Payslip
                    </button>
                    <button
                      onClick={() => setSelectedEmployee(null)}
                      className="px-4 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
      <CSVImportDialog open={showImport} onOpenChange={setShowImport} type="employees" />
    </div>
  );
}
