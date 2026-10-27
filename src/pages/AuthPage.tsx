import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User, Globe, ArrowRight, Hash, Sparkles, Check, Banknote, ShieldCheck, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import caribbeanHero from "@/assets/caribbean-hero.jpg";

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isPinMode, setIsPinMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { first_name: firstName.trim(), last_name: lastName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Check your email to verify your account!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePinAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !pin.trim()) return;
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("PIN must be 4-6 digits");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pin-login", {
        body: { email: email.trim(), pin },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "PIN login failed");
      }

      // Set the session manually
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionErr) throw sessionErr;
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "PIN login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Google sign-in failed. Please try again.");
        return;
      }
      if (result.redirected) return;
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        toast.error("Unable to confirm your sign-in. Please try again.");
        return;
      }
      navigate("/", { replace: true });
    } catch {
      toast.error("Google sign-in is temporarily unavailable. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, hsl(195 60% 30%) 0%, hsl(330 40% 35%) 50%, hsl(18 70% 45%) 100%)" }}>
      {/* Left branding panel — Caribbean vibrant */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        {/* Background photo */}
        <img
          src={caribbeanHero}
          alt="Saint Lucia Pitons at sunset"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Vibrant tropical gradient overlay (nano banana yellow → coral → magenta → deep teal) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, hsl(48 100% 55% / 0.55) 0%, hsl(18 95% 58% / 0.65) 28%, hsl(330 85% 50% / 0.7) 58%, hsl(195 90% 22% / 0.92) 100%)",
          }}
        />
        {/* Soft glow blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-40" style={{ background: "hsl(48 100% 60%)" }} />
        <div className="absolute -bottom-24 -right-10 w-96 h-96 rounded-full blur-3xl opacity-40" style={{ background: "hsl(330 90% 55%)" }} />

        <div className="relative z-10 px-12 py-16 text-white max-w-xl">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg">
              <span className="font-display font-bold text-xl text-white">OE</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-white drop-shadow">OECS HR & Payroll</h1>
              <p className="text-white/80 text-sm flex items-center gap-1.5">
                <MapPin size={12} /> Built for the Caribbean
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/30 mb-6">
            <Sparkles size={14} className="text-accent" />
            <span className="text-xs font-medium tracking-wide uppercase">Now with QuickBooks Sync</span>
          </div>

          <h2 className="font-display font-bold text-5xl leading-[1.05] mb-5 drop-shadow-lg">
            Payroll that <span style={{ color: "hsl(48 100% 65%)" }}>moves</span> like the islands.
          </h2>
          <p className="text-white/90 text-lg max-w-md mb-8 leading-relaxed">
            NIC, PAYE, gratuity, education levy — calculated automatically across St. Lucia and every OECS island. Pay your team in minutes, not days.
          </p>

          {/* Feature pills */}
          <ul className="space-y-3 mb-10">
            {[
              { icon: Banknote, text: "One-click payroll runs & digital payslips" },
              { icon: ShieldCheck, text: "OECS-compliant: NIC, PAYE, TD5, C3 exports" },
              { icon: Check, text: "Native QuickBooks Online journal sync" },
            ].map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-white/95">
                <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center flex-shrink-0">
                  <f.icon size={16} className="text-accent" />
                </div>
                <span className="text-sm font-medium">{f.text}</span>
              </li>
            ))}
          </ul>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 pt-6 border-t border-white/20">
            {[
              { v: "7", l: "OECS islands" },
              { v: "<5 min", l: "to run payroll" },
              { v: "100%", l: "compliance" },
            ].map((s, i) => (
              <div key={i}>
                <div className="font-display font-bold text-2xl" style={{ color: "hsl(48 100% 65%)" }}>{s.v}</div>
                <div className="text-xs text-white/75 uppercase tracking-wide">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="font-display font-bold text-primary-foreground text-sm">OE</span>
            </div>
            <h1 className="font-display font-bold text-foreground text-lg">OECS HR & Payroll</h1>
          </div>

          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              {isSignUp ? "Create your account" : isPinMode ? "PIN Login" : "Welcome back"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isSignUp
                ? "Sign up to access your employee portal"
                : isPinMode
                ? "Enter your email or username and PIN to sign in"
                : "Sign in to your employee portal"}
            </p>
          </div>

          {/* Login method toggle (only on sign-in) */}
          {!isSignUp && (
            <div className="flex rounded-lg bg-secondary p-1">
              <button
                onClick={() => setIsPinMode(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                  !isPinMode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Lock size={14} />
                Password
              </button>
              <button
                onClick={() => setIsPinMode(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                  isPinMode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Hash size={14} />
                PIN
              </button>
            </div>
          )}

          {/* Google (not in PIN mode) */}
          {!isPinMode && (
            <>
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <Globe size={18} />
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          {/* PIN Login Form */}
          {isPinMode ? (
            <form onSubmit={handlePinAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email or username</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email or assigned username"
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">PIN (4-6 digits)</label>
                <div className="relative">
                  <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setPin(val);
                    }}
                    placeholder="••••"
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In with PIN"}
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            /* Email/Password form */
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isSignUp && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">First Name</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First"
                        className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last"
                      className="w-full px-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {!isPinMode && (
            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary font-medium hover:underline"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          )}

          {isPinMode && (
            <p className="text-center text-xs text-muted-foreground">
              PIN login must be enabled by your administrator.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
