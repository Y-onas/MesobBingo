import { Users, Clock, RefreshCw } from "lucide-react";

interface GameRoomCardProps {
  stake: number;
  isActive: boolean;
  players: number;
  maxPlayers?: number;
  derash: number;
  onPlay: () => void;
  startsIn?: string;
  type?: string;
}

const GameRoomCard = ({ stake, isActive, players, maxPlayers = 100, derash, onPlay, startsIn = "00:42", type = "Standard" }: GameRoomCardProps) => {
  return (
    <div className="bg-card border border-border rounded-lg p-2.5 space-y-1.5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {isActive && (
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-1 h-1 rounded-full bg-success animate-pulse" />
              <span className="text-[9px] font-semibold text-success uppercase tracking-wide">Live Game</span>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground">{stake}</span>
            <span className="text-xs text-muted-foreground">ETB</span>
          </div>
          <span className="text-[9px] text-muted-foreground">Entry Stake</span>
        </div>
        
        <div className="text-right">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Prize Pool</div>
          <div className="text-base font-bold text-primary">{derash.toLocaleString()} ETB</div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <div>
            <div className="text-[8px] uppercase tracking-wide">Players</div>
            <div className="text-xs font-semibold text-foreground">{players} / {maxPlayers}</div>
          </div>
        </div>
        
        {isActive && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <div>
              <div className="text-[8px] uppercase tracking-wide">Starts In</div>
              <div className="text-xs font-semibold text-foreground">{startsIn}</div>
            </div>
          </div>
        )}
      </div>

      {/* Join Button */}
      <button
        onClick={onPlay}
        className="w-full py-2 rounded-lg font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 transition-opacity"
      >
        JOIN GAME
      </button>
    </div>
  );
};

export default GameRoomCard;
