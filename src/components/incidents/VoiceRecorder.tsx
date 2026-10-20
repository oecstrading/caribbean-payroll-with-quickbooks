import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceRecorderProps {
  siteId: string;
  onReportGenerated: (data: { title: string; description: string; audioUrl: string; rawTranscript: string; aiDraft: string }) => void;
}

export default function VoiceRecorder({ siteId, onReportGenerated }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [levels, setLevels] = useState<number[]>(new Array(24).fill(0));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const updateLevels = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const step = Math.floor(data.length / 24);
    const newLevels = Array.from({ length: 24 }, (_, i) => data[i * step] / 255);
    setLevels(newLevels);
    animFrameRef.current = requestAnimationFrame(updateLevels);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      updateLevels();
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;
    setRecording(false);
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(timerRef.current);
    setLevels(new Array(24).fill(0));

    await new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = () => resolve();
      mediaRecorderRef.current!.stop();
    });

    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());

    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
    if (blob.size < 1000) { toast.error("Recording too short"); return; }

    setProcessing(true);
    try {
      // Upload audio
      const ext = blob.type.includes("webm") ? "webm" : "mp4";
      const path = `reports/${(await supabase.auth.getUser()).data.user?.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("incident-audio").upload(path, blob);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("incident-audio").getPublicUrl(path);

      // Process with AI
      const { data, error } = await supabase.functions.invoke("process-incident-report", {
        body: { audioUrl: urlData.publicUrl, siteId },
      });
      if (error) throw error;

      onReportGenerated({
        title: data.title,
        description: data.report,
        audioUrl: urlData.publicUrl,
        rawTranscript: data.transcript,
        aiDraft: data.report,
      });
      toast.success("AI report generated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to process voice report");
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (processing) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 py-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        </div>
        <p className="text-sm font-medium text-foreground">AI is generating your professional report...</p>
        <p className="text-xs text-muted-foreground">Transcribing audio and structuring incident details</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-muted-foreground">Voice Report (AI-Powered)</label>

      <AnimatePresence mode="wait">
        {recording ? (
          <motion.div key="recording" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {/* Waveform */}
            <div className="flex items-end justify-center gap-[3px] h-16 bg-muted/50 rounded-lg px-3">
              {levels.map((l, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 rounded-full bg-destructive"
                  animate={{ height: Math.max(4, l * 56) }}
                  transition={{ duration: 0.05 }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-destructive font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                {formatTime(duration)}
              </span>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                <Square size={14} /> Stop & Process
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={startRecording}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-primary/30 rounded-lg text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            <Mic size={16} /> Tap to Record Voice Report
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
