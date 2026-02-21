import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface CurrentCallProps {
  letter: string;
  number: number;
  status: "playing" | "ready" | "waiting";
}

const LETTER_BG: Record<string, string> = {
  B: "from-[hsl(220_75%_55%)] to-[hsl(220_75%_45%)]",
  I: "from-[hsl(20_100%_55%)] to-[hsl(20_100%_45%)]",
  N: "from-[hsl(165_70%_45%)] to-[hsl(165_70%_35%)]",
  G: "from-[hsl(270_60%_60%)] to-[hsl(270_60%_50%)]",
  O: "from-[hsl(0_75%_55%)] to-[hsl(0_75%_45%)]",
};

const CurrentCall = ({ letter, number, status }: CurrentCallProps) => {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Check speech synthesis support and load voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSpeechSupported(false);
      console.warn('Speech Synthesis not supported in this browser');
      return;
    }

    // Load voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        console.log('Voices loaded:', voices.length);
      }
    };

    // Try loading immediately
    loadVoices();

    // Also listen for voiceschanged event (needed in some browsers)
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Store utterance globally to prevent garbage collection in some browsers (e.g. Safari)
  useEffect(() => {
    if (!(window as any).utterances) {
      (window as any).utterances = [];
    }
  }, []);

  // Auto-speak when voice is enabled and number changes
  useEffect(() => {
    if (voiceEnabled && speechSupported && 'speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      // Small delay to ensure cancellation completes
      const timeoutId = setTimeout(() => {
        try {
          const utterance = new SpeechSynthesisUtterance(`${letter} ${number}`);
          utterance.rate = 0.9;
          utterance.pitch = 1;
          utterance.volume = 1;
          utterance.lang = 'en-US';
          
          // Add event listeners for debugging
          utterance.onstart = () => console.log('Speech started:', `${letter} ${number}`);
          utterance.onerror = (e) => console.error('Speech error:', e);
          utterance.onend = () => {
            console.log('Speech ended');
            if ((window as any).utterances) {
              const index = (window as any).utterances.indexOf(utterance);
              if (index !== -1) {
                (window as any).utterances.splice(index, 1);
              }
            }
          };
          
          if ((window as any).utterances) {
            (window as any).utterances.push(utterance);
          }
          
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          console.error('Speech synthesis error:', error);
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        // Do not cancel speech synthesis on unmount to avoid cutting it off
      };
    }
  }, [letter, number, voiceEnabled, speechSupported]);

  const toggleVoice = () => {
    if (!speechSupported) {
      alert('Speech synthesis is not supported in this browser/environment');
      return;
    }

    const newValue = !voiceEnabled;
    setVoiceEnabled(newValue);

    try {
      if (voiceEnabled && 'speechSynthesis' in window) {
        // Turning off - cancel any ongoing speech
        window.speechSynthesis.cancel();
      } else if (newValue && 'speechSynthesis' in window) {
        // Unlock speech synthesis on mobile via direct user interaction
        const unlockUtterance = new SpeechSynthesisUtterance('');
        unlockUtterance.volume = 0;
        window.speechSynthesis.speak(unlockUtterance);
      }
    } catch (e) {
      console.error('Speech synthesis toggle error:', e);
    }
  };

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
