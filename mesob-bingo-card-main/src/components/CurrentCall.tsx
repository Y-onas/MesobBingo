import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechSynthesis, unlockSpeechSynthesis, cancelSpeech } from "@/hooks/useSpeechSynthesis";

interface CurrentCallProps {
  letter: string;
  number: number;
  status: "playing" | "ready" | "waiting";
  voiceEnabled: boolean;
  onVoiceToggle: (enabled: boolean) => void;
}

const LETTER_BG: Record<string, string> = {
  B: "from-[hsl(220_75%_55%)] to-[hsl(220_75%_45%)]",
  I: "from-[hsl(20_100%_55%)] to-[hsl(20_100%_45%)]",
  N: "from-[hsl(165_70%_45%)] to-[hsl(165_70%_35%)]",
  G: "from-[hsl(270_60%_60%)] to-[hsl(270_60%_50%)]",
  O: "from-[hsl(0_75%_55%)] to-[hsl(0_75%_45%)]",
};

const CurrentCall = ({ letter, number, status, voiceEnabled, onVoiceToggle }: CurrentCallProps) => {
  const { speechSupported } = useSpeechSynthesis({
    enabled: voiceEnabled,
    text: `${letter} ${number}`,
  });

  const toggleVoice = () => {
    if (!speechSupported) {
      alert('Speech synthesis is not supported in this browser/environment');
      return;
    }

    const newValue = !voiceEnabled;
    onVoiceToggle(newValue);

    // Save to localStorage
    try {
      localStorage.setItem('bingoVoiceEnabled', String(newValue));
    } catch (e) {
      console.error('Failed to save voice setting to localStorage', e);
    }

    if (voiceEnabled) {
      // Turning off - cancel any ongoing speech
      cancelSpeech();
    } else {
      // Turning on - unlock speech synthesis on mobile
      unlockSpeechSynthesis();
    }
  };

  // Load voices using addEventListener to avoid conflicts
  React.useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  return (
    <div className="glass-card p-2">
      {/* Status and Voice */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn(
          "text-[10px] font-medium capitalize",
          status === "playing" && "text-success",
          status === "ready" && "text-primary",
          status === "waiting" && "text-muted-foreground"
        )}>
          {status}
        </span>
        <button 
          onClick={toggleVoice}
          disabled={!speechSupported}
          className={cn(
            "flex items-center gap-1 transition-colors",
            !speechSupported && "opacity-50 cursor-not-allowed",
            voiceEnabled ? "text-success" : "text-primary hover:text-primary/80"
          )}
          title={!speechSupported ? "Speech not supported in this browser" : voiceEnabled ? "Voice On" : "Voice Off"}
        >
          {voiceEnabled ? (
            <Volume2 className="w-3 h-3 animate-pulse" />
          ) : (
            <VolumeX className="w-3 h-3" />
          )}
          <span className="text-[10px] font-medium">
            {voiceEnabled ? "On" : "Off"}
          </span>
        </button>
      </div>

      {/* Current Call Display */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-card/50">
        <span className="text-[10px] font-medium text-muted-foreground">Current</span>
        <div className="flex-1" />
        <div className={cn(
          "flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-gradient-to-br font-bold text-white text-base bingo-ball",
          LETTER_BG[letter] || "from-primary to-primary/80"
        )}>
          <span>{letter}</span>
          <span>-</span>
          <span>{number}</span>
        </div>
      </div>
    </div>
  );
};

export default CurrentCall;
