import { cn } from "@/lib/utils";

interface BingoCardProps {
  boardNumber: number;
  numbers: number[][];
  markedNumbers: number[];
  calledNumbers: number[];
  onNumberClick?: (num: number) => void;
}

const BINGO_LETTERS = ["B", "I", "N", "G", "O"];
const LETTER_COLORS = [
  "bg-[hsl(220_75%_55%)]",
  "bg-[hsl(20_100%_55%)]", 
  "bg-[hsl(165_70%_45%)]",
  "bg-[hsl(270_60%_60%)]",
  "bg-[hsl(0_75%_55%)]"
];

const BingoCard = ({ 
  boardNumber, 
  numbers, 
  markedNumbers, 
  calledNumbers,
  onNumberClick 
}: BingoCardProps) => {
  const isMarked = (num: number) => markedNumbers.includes(num) || num === 0;
  const isCalled = (num: number) => calledNumbers.includes(num);

  return (
    <div className="glass-card p-2 animate-scale-in h-full flex flex-col">
      {/* BINGO Header */}
      <div className="grid grid-cols-5 gap-0.5 mb-1">
        {BINGO_LETTERS.map((letter, idx) => (
          <div
            key={letter}
            className={cn(
              "flex items-center justify-center h-5 rounded font-bold text-[10px] text-white",
              LETTER_COLORS[idx]
            )}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Number Grid */}
      <div className="grid grid-cols-5 gap-0.5 flex-1">
        {numbers.flat().map((num, idx) => {
          const isFreeSpace = num === 0;
          const marked = isMarked(num);
          const called = isCalled(num);
          
          return (
            <button
              key={idx}
              onClick={() => !isFreeSpace && onNumberClick?.(num)}
              disabled={isFreeSpace}
              className={cn(
                "flex items-center justify-center rounded font-bold text-[11px] transition-all duration-200",
                isFreeSpace && "bg-primary text-primary-foreground",
                !isFreeSpace && marked && "bg-primary text-primary-foreground shadow-md scale-95",
                !isFreeSpace && !marked && called && "bg-success/30 text-success border border-success",
                !isFreeSpace && !marked && !called && "bg-card/80 text-foreground hover:bg-card"
              )}
            >
              {isFreeSpace ? "★" : num}
            </button>
          );
        })}
      </div>

      {/* Board Number */}
      <div className="mt-1 text-center">
        <span className="text-[9px] font-medium text-primary">Board No.{boardNumber}</span>
      </div>
    </div>
  );
};

export default BingoCard;
