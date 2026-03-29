import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ROUTE_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  home: "/dashboard",
  employees: "/employees",
  staff: "/employees",
  payroll: "/payroll",
  roster: "/roster",
  schedule: "/roster",
  attendance: "/attendance",
  incidents: "/incidents",
  incident: "/incidents",
  reports: "/reports",
  daily: "/daily-reports",
  "daily reports": "/daily-reports",
  "guard tour": "/guard-tour",
  patrol: "/guard-tour",
  settings: "/settings",
  invoicing: "/invoicing",
  invoices: "/invoicing",
  applicants: "/applicants",
  recruitment: "/applicants",
  leave: "/leave",
  equipment: "/equipment",
  sites: "/sites",
  "site management": "/sites",
  geofencing: "/geofencing",
  map: "/command-center",
  "command center": "/command-center",
  contractors: "/contractors",
  projects: "/projects",
  compliance: "/compliance",
  performance: "/guard-performance",
  "late report": "/late-clock-in-report",
  violations: "/violations",
  deductions: "/deductions",
};

export default function VoiceCommandListener() {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [displayText, setDisplayText] = useState("");

  const handleCommand = useCallback(
    async (text: string) => {
      const lower = text.toLowerCase().trim();
      setDisplayText(text);

      // Try local route matching first
      for (const [keyword, route] of Object.entries(ROUTE_MAP)) {
        if (lower.includes(keyword)) {
          toast.success(`Navigating to ${keyword}`);
          navigate(route);
          setActive(false);
          return;
        }
      }

      // Quick action keywords
      if (lower.includes("clock in") || lower.includes("clock-in")) {
        navigate("/guard-tour");
        toast.info("Opening Guard Tour for clock-in");
        setActive(false);
        return;
      }
      if (lower.includes("clock out") || lower.includes("clock-out")) {
        navigate("/guard-tour");
        toast.info("Opening Guard Tour for clock-out");
        setActive(false);
        return;
      }
      if (lower.includes("new incident") || lower.includes("file report") || lower.includes("report incident")) {
        navigate("/incidents");
        toast.info("Opening Incident Reports");
        setActive(false);
        return;
      }
      if (lower.includes("panic") || lower.includes("emergency") || lower.includes("help")) {
        toast.error("For emergencies, use the Panic Button on screen", { duration: 5000 });
        setActive(false);
        return;
      }

      // If no match, use AI to interpret
      setProcessing(true);
      try {
        const { data, error } = await supabase.functions.invoke("voice-command", {
          body: { command: text },
        });
        if (error) throw error;

        if (data?.route) {
          toast.success(data.message || `Navigating...`);
          navigate(data.route);
        } else {
          toast.info(data?.message || "I didn't understand that command. Try 'Go to dashboard' or 'Show employees'.");
        }
      } catch {
        toast.info("Command not recognized. Try: 'Go to dashboard', 'Show roster', 'File incident report'.");
      } finally {
        setProcessing(false);
        setActive(false);
      }
    },
    [navigate]
  );

  const { isListening, transcript, isSupported, start, stop } = useVoiceInput({
    onResult: handleCommand,
    continuous: false,
  });

  useEffect(() => {
    if (active && !isListening) {
      start();
    }
  }, [active, isListening, start]);

  const toggleCommand = useCallback(() => {
    if (active) {
      stop();
      setActive(false);
      setDisplayText("");
    } else {
      setActive(true);
      setDisplayText("");
    }
  }, [active, stop]);

  // Keyboard shortcut: Ctrl+Shift+V
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "V") {
        e.preventDefault();
        toggleCommand();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleCommand]);

  if (!isSupported) return null;

  return (
    <>
      {/* Floating mic button */}
      <button
        onClick={toggleCommand}
        className={`fixed bottom-24 left-4 md:bottom-8 md:left-8 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          active
            ? "bg-destructive text-destructive-foreground scale-110"
            : "bg-primary text-primary-foreground hover:scale-105"
        }`}
        title="Voice Commands (Ctrl+Shift+V)"
      >
        {processing ? (
          <Loader2 size={22} className="animate-spin" />
        ) : active ? (
          <MicOff size={22} />
        ) : (
          <Mic size={22} />
        )}
      </button>

      {/* Voice command overlay */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-40 left-4 md:bottom-24 md:left-8 z-50 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-4 w-72"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {processing ? "Processing..." : "Listening..."}
                </p>
                <p className="text-xs text-muted-foreground">Say a command</p>
              </div>
            </div>

            {(transcript || displayText) && (
              <div className="bg-secondary/50 rounded-lg p-2 mb-3">
                <p className="text-sm text-foreground italic">"{transcript || displayText}"</p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Try saying:</p>
              <p className="text-xs text-muted-foreground">"Go to dashboard"</p>
              <p className="text-xs text-muted-foreground">"Show roster"</p>
              <p className="text-xs text-muted-foreground">"File incident report"</p>
              <p className="text-xs text-muted-foreground">"Clock me in"</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
