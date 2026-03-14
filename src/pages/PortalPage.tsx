import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, CreditCard, CalendarDays, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import PortalPayslips from "@/components/portal/PortalPayslips";
import PortalBankInfo from "@/components/portal/PortalBankInfo";
import PortalLeave from "@/components/portal/PortalLeave";
import PortalProfile from "@/components/portal/PortalProfile";

const tabs = [
  { id: "payslips", label: "My Payslips", icon: FileText },
  { id: "bank", label: "Bank Info", icon: CreditCard },
  { id: "leave", label: "Leave", icon: CalendarDays },
  { id: "profile", label: "My Profile", icon: User },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState<TabId>("payslips");
  const { user, signOut } = useAuth();

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Employee Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome, {user?.user_metadata?.first_name || user?.email?.split("@")[0] || "Employee"}
          </p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 md:px-4 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={16} className="flex-shrink-0" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === "payslips" && <PortalPayslips />}
        {activeTab === "bank" && <PortalBankInfo />}
        {activeTab === "leave" && <PortalLeave />}
        {activeTab === "profile" && <PortalProfile />}
      </motion.div>
    </div>
  );
}
