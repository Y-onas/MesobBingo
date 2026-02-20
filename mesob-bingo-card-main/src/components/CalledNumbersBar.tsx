import { cn } from "@/lib/utils";

interface CalledNumbersBarProps {
  calledNumbers: { letter: string; number: number }[];
}

const LETTER_BG: Record<string, string> = {
  B: "bg-[hsl(220_75%_55%)]",
  I: "bg-[hsl(20_100%_55%)]",
  N: "bg-[hsl(165_70%_45%)]",
  G: "bg-[hsl(270_60%_60%)]",
  O: "bg-[hsl(0_75%_55%)]",
};

const CalledNumbersBar = ({ calledNumbers }: CalledNumbersBarProps) => {
  const recentCalls = calledNumbers.slice(-5);

  return (
    <div className="flex items-center justify-center gap-1 py-1">
      {recentCalls.map((call, idx) => (
        <div
          key={idx}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-lg text-white font-bold text-[10px]",
            LETTER_BG[call.letter],
            idx === recentCalls.length - 1 && "ring-1 ring-white/50 scale-110"
          )}
        >
          {call.letter}
        </div>
      ))}
    </div>
  );
};

export default CalledNumbersBar;
