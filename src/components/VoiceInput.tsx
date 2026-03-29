import { Mic, MicOff } from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCallback } from "react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  /** If true, appends to existing value instead of replacing */
  append?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export default function VoiceInput({ onTranscript, append, className, size = "sm" }: VoiceInputProps) {
  const handleResult = useCallback(
    (text: string) => {
      onTranscript(text);
    },
    [onTranscript]
  );

  const { isListening, isSupported, toggle } = useVoiceInput({
    onResult: handleResult,
    continuous: true,
  });

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (!isListening) toast.info("Listening... speak now");
        toggle();
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-all",
        size === "sm" ? "w-8 h-8" : "w-10 h-10",
        isListening
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
        className
      )}
      title={isListening ? "Stop listening" : "Voice input"}
    >
      {isListening ? <MicOff size={size === "sm" ? 14 : 18} /> : <Mic size={size === "sm" ? 14 : 18} />}
    </button>
  );
}
