import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const HOLD_DURATION = 3000; // 3 seconds

export default function PanicButton() {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "holding" | "sending" | "sent">("idle");
  const [progress, setProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef(0);

  const cleanup = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (progressInterval.current) { clearInterval(progressInterval.current); progressInterval.current = null; }
  }, []);

  const triggerPanic = useCallback(async () => {
    if (!user) { toast.error("You must be logged in"); return; }
    setState("sending");
    setProgress(100);

    try {
      // Get high-accuracy GPS
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;

      // Find nearest site for context
      const { data: sites } = await supabase
        .from("client_sites")
        .select("id, name, latitude, longitude")
        .eq("status", "active");

      let nearestSiteId: string | null = null;
      let minDist = Infinity;

      for (const site of sites || []) {
        if (site.latitude && site.longitude) {
          const d = Math.sqrt(
            Math.pow(site.latitude - latitude, 2) +
            Math.pow(site.longitude - longitude, 2)
          );
          if (d < minDist) { minDist = d; nearestSiteId = site.id; }
        }
      }

      const { error } = await supabase.from("emergency_alerts").insert({
        user_id: user.id,
        site_id: nearestSiteId,
        latitude,
        longitude,
      });

      if (error) throw error;

      // Play confirmation sound
      try {
        const audioCtx = new AudioContext();
        // Three short beeps
        for (let i = 0; i < 3; i++) {
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.frequency.value = 880;
          oscillator.type = "square";
          gainNode.gain.value = 0.3;
          oscillator.start(audioCtx.currentTime + i * 0.2);
          oscillator.stop(audioCtx.currentTime + i * 0.2 + 0.1);
        }
      } catch {}

      setState("sent");
      toast.success("Emergency alert sent! Help is on the way.", { duration: 10000 });

      // Reset after 30 seconds
      setTimeout(() => {
        setState("idle");
        setProgress(0);
      }, 30000);
    } catch (err: any) {
      setState("idle");
      setProgress(0);
      if (err.code === 1) {
        toast.error("Location access denied. Enable GPS to use the panic button.");
      } else {
        toast.error(err.message || "Failed to send emergency alert");
      }
    }
  }, [user]);

  const onPressStart = useCallback(() => {
    if (state !== "idle") return;
    setState("holding");
    startTime.current = Date.now();

    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const pct = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setProgress(pct);
    }, 30);

    holdTimer.current = setTimeout(() => {
      cleanup();
      triggerPanic();
    }, HOLD_DURATION);
  }, [state, cleanup, triggerPanic]);

  const onPressEnd = useCallback(() => {
    if (state === "holding") {
      cleanup();
      setState("idle");
      setProgress(0);
      if (progress < 100) {
        toast.info("Hold for 3 seconds to activate");
      }
    }
  }, [state, cleanup, progress]);

  return (
    <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50">
      <AnimatePresence mode="wait">
        {state === "sent" ? (
          <motion.div
            key="sent"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative"
          >
            <div className="w-20 h-20 rounded-full bg-destructive/20 border-2 border-destructive flex items-center justify-center animate-pulse">
              <Check size={32} className="text-destructive" />
            </div>
            <p className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-destructive whitespace-nowrap uppercase tracking-wide">
              Alert Sent
            </p>
          </motion.div>
        ) : (
          <motion.button
            key="button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onPointerDown={onPressStart}
            onPointerUp={onPressEnd}
            onPointerLeave={onPressEnd}
            onContextMenu={(e) => e.preventDefault()}
            disabled={state === "sending"}
            className="relative w-20 h-20 rounded-full shadow-lg select-none touch-none focus:outline-none"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Progress ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="hsl(var(--destructive) / 0.2)" strokeWidth="4" />
              <circle
                cx="40" cy="40" r="36"
                fill="none"
                stroke="hsl(var(--destructive))"
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - progress / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-75"
              />
            </svg>

            {/* Button face */}
            <div className={`absolute inset-1.5 rounded-full flex flex-col items-center justify-center transition-colors ${
              state === "holding"
                ? "bg-destructive text-destructive-foreground"
                : state === "sending"
                  ? "bg-destructive/80 text-destructive-foreground"
                  : "bg-destructive/90 text-destructive-foreground hover:bg-destructive"
            }`}>
              {state === "sending" ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-[8px] font-bold mt-0.5">SENDING</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={20} />
                  <span className="text-[9px] font-bold mt-0.5 tracking-wider">PANIC</span>
                </>
              )}
            </div>

            {/* Hold instruction */}
            {state === "idle" && (
              <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground whitespace-nowrap">
                Hold 3s
              </p>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
