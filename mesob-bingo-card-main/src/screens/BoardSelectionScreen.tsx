import { ArrowLeft } from "lucide-react";
import NumberGrid from "@/components/NumberGrid";
import BingoCard from "@/components/BingoCard";
import type { GameState } from "@/hooks/useGameState";
import { useState } from "react";

interface BoardSelectionScreenProps {
  game: GameState;
  availableBoards: number[];
  balance: number;
  countdownSeconds: number | null;
  onSelectBoard: (boardNumber: number) => void;
  onBack: () => void;
  onRefreshBalance: () => void;
}

// Sample board for preview (will be replaced with actual board data)
const SAMPLE_BOARD = [
  [1, 22, 39, 51, 62],
  [15, 25, 35, 47, 75],
  [3, 23, 0, 50, 66],
  [8, 26, 44, 49, 70],
  [4, 28, 38, 53, 67],
];

const BoardSelectionScreen = ({
  game,
  availableBoards,
  balance,
  countdownSeconds,
  onSelectBoard,
  onBack,
  onRefreshBalance,
}: BoardSelectionScreenProps) => {
  const [selectedBoard, setSelectedBoard] = useState<number | null>(null);
  const [showRange, setShowRange] = useState<'1-100' | '101-200'>('1-100');

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectBoard = (boardNum: number) => {
    setSelectedBoard(boardNum);
  };

  const handleStartGame = () => {
    if (selectedBoard) {
      onSelectBoard(selectedBoard);
    }
  };

  // Get boards in current range
  const currentRangeBoards = availableBoards.filter(num => 
    showRange === '1-100' ? num <= 100 : num > 100
  );

  return (
    <div className="min-h-screen flex flex-col pb-6">
      {/* Header Stats */}
      <div className="glass-card mx-4 mt-4 p-3 rounded-2xl">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Active Game</span>
            <span className="font-bold text-foreground">{game.playerCount}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Stake</span>
            <span className="font-bold text-primary">{game.entryFee} ETB</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Start in</span>
            <span className="font-bold text-accent">
              {countdownSeconds !== null ? formatCountdown(countdownSeconds) : '--:--'}
            </span>
          </div>
        </div>
      </div>

      {/* Number Grid */}
      <div className="flex-1 px-4 py-4">
        <NumberGrid 
          start={showRange === '1-100' ? 1 : 101}
          end={showRange === '1-100' ? 100 : 200}
          calledNumbers={[]}
          selectedNumbers={selectedBoard ? [selectedBoard] : []}
          unavailableNumbers={
            availableBoards.length === 0
              ? Array.from({ length: 100 }, (_, i) => (showRange === '1-100' ? 1 : 101) + i)
              : Array.from({ length: 100 }, (_, i) => (showRange === '1-100' ? 1 : 101) + i)
                  .filter(n => !availableBoards.includes(n))
          }
          onNumberClick={handleSelectBoard}
        />

        {/* Range Toggle */}
        <div className="flex justify-center mt-4">
          <button 
            onClick={() => setShowRange(showRange === '1-100' ? '101-200' : '1-100')}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-card/50 text-muted-foreground hover:bg-card transition-colors"
          >
            {showRange === '1-100' ? 'Show 100-200' : 'Show 1-100'}
          </button>
        </div>

        {/* Selected Board Preview */}
        {selectedBoard && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground text-center mb-2">Board {selectedBoard}</p>
            <div className="max-w-[200px] mx-auto">
              <BingoCard
                boardNumber={selectedBoard}
                numbers={SAMPLE_BOARD}
                markedNumbers={[]}
                calledNumbers={[]}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-4 flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-2xl font-bold text-foreground bg-card hover:bg-card/80 transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={handleStartGame}
          disabled={!selectedBoard}
          className="flex-[2] py-4 rounded-2xl font-bold text-primary-foreground bg-primary shadow-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Game
        </button>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 mt-2">
        <p className="text-sm text-muted-foreground">@Mesob_bingo_bot</p>
      </footer>
    </div>
  );
};

export default BoardSelectionScreen;
