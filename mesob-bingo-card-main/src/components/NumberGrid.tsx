import { cn } from "@/lib/utils";

interface NumberGridProps {
  start?: number;
  end?: number;
  calledNumbers: number[];
  selectedNumbers: number[];
  unavailableNumbers?: number[];
  onNumberClick?: (num: number) => void;
  compact?: boolean;
}

const NumberGrid = ({ 
  start = 1, 
  end = 100, 
  calledNumbers, 
  selectedNumbers,
  unavailableNumbers = [],
  onNumberClick,
  compact = false 
}: NumberGridProps) => {
  const numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const getNumberState = (num: number) => {
    if (selectedNumbers.includes(num)) return "selected";
    if (unavailableNumbers.includes(num)) return "unavailable";
    if (calledNumbers.includes(num)) return "called";
    return "default";
  };

  return (
    <div className={cn(
      "grid gap-1.5",
      compact ? "grid-cols-10" : "grid-cols-10"
    )}>
      {numbers.map((num) => {
        const state = getNumberState(num);
        return (
          <button
            key={num}
            onClick={() => state !== "unavailable" && onNumberClick?.(num)}
            disabled={state === "unavailable"}
            className={cn(
              "number-cell text-xs font-bold",
              compact ? "h-7 text-[10px]" : "h-8",
              state === "selected" && "bg-gradient-orange text-primary-foreground shadow-md",
              state === "unavailable" && "bg-primary/50 text-primary-foreground cursor-not-allowed opacity-70",
              state === "called" && "bg-destructive/80 text-destructive-foreground",
              state === "default" && "bg-card/60 text-foreground/80 hover:bg-card"
            )}
          >
            {num}
          </button>
        );
      })}
    </div>
  );
};

export default NumberGrid;
