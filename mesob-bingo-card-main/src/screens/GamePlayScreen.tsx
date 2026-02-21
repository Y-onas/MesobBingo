import { RefreshCw, LogOut, Volume2, VolumeX } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import type { GameState } from "@/hooks/useGameState";

interface GamePlayScreenProps {
  game: GameState;
  boardContent: number[][];
  boardNumber: number;
  balance: number;
  markedNumbers: Set<number>;
  onMarkNumber: (number: number) => void;
  onClaimBingo: () => void;
  onRefreshBalance: () => void;
  onLeave?: () => void;
  voiceEnabled: boolean;
  onVoiceToggle: (enabled: boolean) => void;
}

const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];
const BINGO_RANGES: Record<string, [number, number]> = {
  B: [1, 15],
  I: [16, 30],
  N: [31, 45],
  G: [46, 60],
  O: [61, 75],
};

const getBingoLetter = (num: number): string => {
  for (const letter of BINGO_LETTERS) {
    const [start, end] = BINGO_RANGES[letter];
    if (num >= start && num <= end) return letter;
  }
  return 'B';
};

const GamePlayScreen = ({
  game,
  boardContent,
  boardNumber,
  balance,
  markedNumbers,
  onMarkNumber,
  onClaimBingo,
  onRefreshBalance,
  onLeave,
  voiceEnabled,
  onVoiceToggle,
}: GamePlayScreenProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  
  const calledNumbers = game.calledNumbers || [];
  const calledSet = new Set(calledNumbers);
  const effectiveMarks = Array.from(markedNumbers);

  // Sync voice state with localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('bingoVoiceEnabled');
    const savedValue = saved === 'true';
    if (savedValue !== voiceEnabled) {
      console.log('Syncing voice state from localStorage:', savedValue);
      onVoiceToggle(savedValue);
    }
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefreshBalance();
    setTimeout(() => setIsRefreshing(false), 300);
  };

  // Get recently called letters
  const recentLetters = calledNumbers.slice(-5).map(num => getBingoLetter(num));
  const calledLettersSet = new Set(recentLetters);

  // Get color for current letter
  const getLetterColor = (letter: string) => {
    const colors = {
      B: { bg: "#3b82f6", glow: "rgba(59, 130, 246, 0.45)" },   // Blue
      I: { bg: "#f97316", glow: "rgba(249, 115, 22, 0.45)" },   // Orange
      N: { bg: "#10b981", glow: "rgba(16, 185, 129, 0.45)" },   // Green
      G: { bg: "#a855f7", glow: "rgba(168, 85, 247, 0.45)" },   // Purple
      O: { bg: "#ef4444", glow: "rgba(239, 68, 68, 0.45)" },    // Red
    };
    return colors[letter as keyof typeof colors] || colors.B;
  };

  const currentLetterColor = game.currentCall ? getLetterColor(game.currentCall.letter) : getLetterColor('B');

  // Voice synthesis setup
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSpeechSupported(false);
    }
    // Pre-load voices to ensure they are available
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // Store utterance globally to prevent garbage collection in some browsers (e.g. Safari)
  useEffect(() => {
    if (!(window as any).utterances) {
      (window as any).utterances = [];
    }
  }, []);

  // Auto-speak when voice is enabled and number changes
  useEffect(() => {
    console.log('Voice effect triggered - voiceEnabled:', voiceEnabled, 'currentCall:', game.currentCall);
    if (voiceEnabled && speechSupported && game.currentCall && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const timeoutId = setTimeout(() => {
        try {
          const text = `${game.currentCall.letter} ${game.currentCall.number}`;
          console.log('Speaking:', text);
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1;
          // Set volume so it's audible
          utterance.volume = 1;
          utterance.lang = 'en-US';
          
          utterance.onstart = () => console.log('Speech started:', text);
          utterance.onerror = (e) => console.error('Speech error:', e);
          utterance.onend = () => {
            console.log('Speech ended');
            // Cleanup from global array when done to prevent memory leaks
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
          console.error('Speech error:', error);
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        // We do NOT want to cancel speech when this component unmounts or simply re-renders.
        // It might cancel the speech prematurely. We only cancel before speaking a new number.
      };
    }
  }, [game.currentCall?.letter, game.currentCall?.number, voiceEnabled, speechSupported]);

  const toggleVoice = useCallback(() => {
    if (!speechSupported) {
      alert('Speech synthesis is not supported in this browser/environment');
      return;
    }

    const newValue = !voiceEnabled;
    console.log('Toggle voice clicked - Current:', voiceEnabled, 'New:', newValue);
    
    // Update state via parent first so UI responds immediately
    onVoiceToggle(newValue);
    console.log('Called onVoiceToggle with:', newValue);
    
    // Save to localStorage
    try {
      localStorage.setItem('bingoVoiceEnabled', String(newValue));
      console.log('Saved to localStorage:', newValue);
    } catch (e) {
      console.error('Failed to save voice setting to localStorage', e);
    }
    
    try {
      if (voiceEnabled && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      } else if (newValue && 'speechSynthesis' in window) {
        // Must "unlock" speech synthesis on mobile via a direct user interaction
        // by speaking an empty text or low volume text synchronously in the click handler
        const unlockUtterance = new SpeechSynthesisUtterance('');
        unlockUtterance.volume = 0;
        window.speechSynthesis.speak(unlockUtterance);
      }
    } catch (e) {
      console.error('Speech synthesis toggle error:', e);
    }
  }, [voiceEnabled, speechSupported, onVoiceToggle]);

  return (
    <div className="min-h-screen bg-background p-3 flex flex-col gap-3">
      {/* Game Stats Bar */}
      <div className="flex items-center justify-between rounded-lg bg-secondary/80 px-3 py-2.5">
        {[
          { label: "Game", value: `#${game.gameId}` },
          { label: "Prize", value: game.totalPot, highlight: true },
          { label: "Players", value: game.playerCount },
          { label: "Bet", value: game.entryFee },
          { label: "Calls", value: game.callCount },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </span>
            <span className={`text-sm font-bold ${stat.highlight ? "text-accent" : "text-foreground"}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-[1fr_1.5fr] gap-3 flex-1">
        {/* Left: Number Grid */}
        <div className="rounded-lg bg-secondary/80 p-4">
          {/* BINGO Header */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            {BINGO_LETTERS.map((letter) => (
              <div key={letter} className="flex items-center justify-center text-base font-bold text-primary">
                {letter}
              </div>
            ))}
          </div>

          {/* 75 Numbers Grid */}
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 15 }, (_, row) =>
              BINGO_LETTERS.map((letter) => {
                const [start] = BINGO_RANGES[letter];
                const num = start + row;
                const isCalled = calledSet.has(num);

                return (
                  <div
                    key={num}
                    className={`flex items-center justify-center rounded-md text-sm font-semibold w-full aspect-square transition-all ${
                      isCalled
                        ? "bg-primary text-primary-foreground font-bold scale-105"
                        : "text-muted-foreground"
                    }`}
                  >
                    {num}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Current Call + Board */}
        <div className="flex flex-col gap-3">
          {/* Current Call - Beautiful design with voice */}
          <div 
            className="rounded-lg p-3 border transition-colors"
            style={{ 
              background: game.status === 'playing' && game.currentCall
                ? `linear-gradient(135deg, ${currentLetterColor.bg}15, hsl(var(--secondary)))`
                : game.status === 'countdown'
                ? "linear-gradient(135deg, rgba(59, 130, 246, 0.08), hsl(var(--secondary)))"
                : "linear-gradient(135deg, rgba(156, 163, 175, 0.08), hsl(var(--secondary)))",
              borderColor: game.status === 'playing' && game.currentCall
                ? `${currentLetterColor.bg}50`
                : game.status === 'countdown'
                ? "rgba(59, 130, 246, 0.3)"
                : "rgba(156, 163, 175, 0.3)"
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span 
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ 
                  color: game.status === 'playing' && game.currentCall
                    ? currentLetterColor.bg
                    : game.status === 'countdown'
                    ? "#3b82f6"
                    : "#9ca3af"
                }}
              >
                {game.status === 'playing' ? 'Playing' : game.status === 'countdown' ? 'Ready' : 'Waiting'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleVoice}
                  disabled={!speechSupported}
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card border border-border transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent hover:border-accent-foreground active:scale-95 cursor-pointer"
                  title={!speechSupported ? "Speech not supported" : voiceEnabled ? "Voice On - Click to turn off" : "Voice Off - Click to turn on"}
                  style={{ touchAction: 'manipulation' }}
                  data-voice-enabled={voiceEnabled}
                >
                  {voiceEnabled ? (
                    <>
                      <Volume2 size={16} className="text-success animate-pulse" />
                      <span className="text-xs font-semibold text-success">ON</span>
                    </>
                  ) : (
                    <>
                      <VolumeX size={16} className="text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">OFF</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">Current</span>
              {game.currentCall && (
                <div 
                  className="flex items-center gap-1 rounded-full px-4 py-1.5"
                  style={{ 
                    background: game.status === 'playing'
                      ? currentLetterColor.bg
                      : game.status === 'countdown'
                      ? "#3b82f6"
                      : "#6b7280",
                    boxShadow: game.status === 'playing'
                      ? `0 0 20px ${currentLetterColor.glow}, 0 0 40px ${currentLetterColor.glow}40`
                      : game.status === 'countdown'
                      ? "0 0 20px rgba(59, 130, 246, 0.45), 0 0 40px rgba(59, 130, 246, 0.15)"
                      : "0 0 20px rgba(107, 114, 128, 0.45)"
                  }}
                >
                  <span className="text-base font-extrabold text-white">
                    {game.currentCall.letter}-{game.currentCall.number}
                  </span>
                </div>
              )}
            </div>

            {/* Called Letters Indicators */}
            <div className="flex items-center justify-center gap-1.5">
              {BINGO_LETTERS.map((l) => (
                <div
                  key={l}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    calledLettersSet.has(l)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {l}
                </div>
              ))}
            </div>
          </div>

          {/* Bingo Board */}
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                Board No.{boardNumber}
              </span>
            </div>

            <div 
              className="rounded-xl bg-card p-4"
              style={{
                boxShadow: "0 0 30px rgba(22, 163, 74, 0.15), 0 0 60px rgba(22, 163, 74, 0.08), inset 0 1px 0 rgba(22, 163, 74, 0.1)",
                border: "1px solid rgba(22, 163, 74, 0.3)"
              }}
            >
              {/* BINGO Header */}
              <div className="grid grid-cols-5 gap-2 mb-3">
                {BINGO_LETTERS.map((letter, i) => {
                  const colors = [
                    "bg-blue-600",      // B - Blue
                    "bg-orange-500",    // I - Orange
                    "bg-green-500",     // N - Green
                    "bg-purple-500",    // G - Purple
                    "bg-red-500",       // O - Red
                  ];
                  return (
                    <div
                      key={letter}
                      className={`flex items-center justify-center rounded-lg py-2 text-base font-extrabold text-white ${colors[i]}`}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>

              {/* Board Cells */}
              <div className="grid grid-cols-5 gap-2">
                {boardContent.flat().map((num, idx) => {
                  const row = Math.floor(idx / 5);
                  const col = idx % 5;
                  const isFreeSpace = num === 0;
                  const isMarked = effectiveMarks.includes(num) || isFreeSpace;

                  return (
                    <button
                      key={idx}
                      onClick={() => !isFreeSpace && onMarkNumber(num)}
                      disabled={isFreeSpace}
                      className={`aspect-square flex items-center justify-center rounded-xl text-xl font-bold transition-all duration-200 active:scale-95 ${
                        isFreeSpace
                          ? "bg-gradient-to-br from-accent to-accent/80 text-white relative overflow-hidden"
                          : isMarked
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                          : "bg-secondary text-secondary-foreground active:bg-muted"
                      }`}
                      style={
                        isFreeSpace
                          ? { boxShadow: "0 0 15px rgba(245, 158, 11, 0.5), inset 0 0 20px rgba(245, 158, 11, 0.2)" }
                          : isMarked
                          ? { boxShadow: "0 0 12px rgba(22, 163, 74, 0.5)" }
                          : {}
                      }
                    >
                      {isFreeSpace ? (
                        <>
                          <span className="text-3xl">★</span>
                          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                        </>
                      ) : (
                        num
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Actions */}
      <div className="space-y-2">
        <button
          onClick={onClaimBingo}
          disabled={game.status !== 'playing'}
          className="w-full py-2.5 rounded-xl font-extrabold text-lg tracking-wide transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "#ff6b35",
            color: "#ffffff",
            boxShadow: "0 0 25px rgba(255, 107, 53, 0.4)"
          }}
        >
          🎉 BINGO!
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-secondary text-secondary-foreground font-semibold text-sm active:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={onLeave || (() => window.location.reload())}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold text-sm active:opacity-90 transition-opacity"
          >
            <LogOut className="w-4 h-4" />
            Leave
          </button>
        </div>
      </div>

      {/* Countdown Overlay */}
      {game.status === 'countdown' && game.countdownRemaining !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-2xl text-center">
            <p className="text-sm font-bold text-warning mb-2">Game Starting In</p>
            <p className="text-4xl font-black text-primary">{game.countdownRemaining}s</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamePlayScreen;
