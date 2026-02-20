import { X } from "lucide-react";
import mesobWinning from "@/assets/mesob-winning.png";

interface WinnerModalProps {
  isOpen: boolean;
  winnerName: string;
  amount: number;
  onClose: () => void;
  onPlayAgain: () => void;
}

const WinnerModal = ({ isOpen, winnerName, amount, onClose, onPlayAgain }: WinnerModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xs glass-card p-4 celebrate">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 p-1.5 text-foreground/50 hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Mesob Winning Image */}
        <div className="flex justify-center mb-3">
          <img 
            src={mesobWinning} 
            alt="Mesob Winning Basket" 
            className="w-28 h-28 object-contain drop-shadow-2xl"
          />
        </div>

        {/* Winner Info */}
        <div className="text-center space-y-1 mb-4">
          <h2 className="text-xl font-bold text-foreground flex items-center justify-center gap-1.5">
            {winnerName} Won! 🎉
          </h2>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-2xl font-bold text-gradient-gold shimmer-gold bg-clip-text">
              {amount.toLocaleString()} Birr
            </span>
          </div>
        </div>

        {/* Play Again Button */}
        <button
          onClick={onPlayAgain}
          className="w-full py-3 rounded-xl font-bold text-base bg-gradient-success text-success-foreground shadow-lg shadow-success/30 hover:shadow-success/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          Play Again
        </button>
      </div>
    </div>
  );
};

export default WinnerModal;
