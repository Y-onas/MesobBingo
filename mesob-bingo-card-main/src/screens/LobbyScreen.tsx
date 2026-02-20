import Header from "@/components/Header";
import GameRoomCard from "@/components/GameRoomCard";
import type { GameRoom } from "@/hooks/useGameState";
import type { ConnectionStatus } from "@/hooks/useSocket";

interface LobbyScreenProps {
  rooms: GameRoom[];
  balance: number;
  onSelectGame: (roomId: number) => void;
  onRefreshBalance: () => void;
  connectionStatus: ConnectionStatus;
}

const LobbyScreen = ({ rooms, balance, onSelectGame, onRefreshBalance, connectionStatus }: LobbyScreenProps) => {
  const totalOnline = rooms.reduce((sum, r) => sum + r.currentPlayers, 0);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header balance={balance} onRefresh={onRefreshBalance} />

      {/* Game Rooms */}
      <div className="flex-1 px-2.5 py-1.5 space-y-1.5 overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Available Rooms
          </h2>
          <span className="text-[10px] font-semibold text-success">
            {connectionStatus === 'connected' ? `${totalOnline} Online` : 'Connecting...'}
          </span>
        </div>

        {rooms.length === 0 && connectionStatus === 'connected' && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No rooms available yet
          </div>
        )}

        {rooms.length === 0 && connectionStatus !== 'connected' && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Loading rooms...
          </div>
        )}
        
        {rooms.map((room) => (
          <GameRoomCard
            key={room.id}
            stake={room.entryFee}
            isActive={room.status !== 'waiting' && room.currentPlayers > 0}
            players={room.currentPlayers}
            maxPlayers={room.maxPlayers}
            derash={room.totalPot}
            startsIn={room.startsIn ? formatCountdown(room.startsIn) : undefined}
            onPlay={() => onSelectGame(room.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <footer className="text-center py-1.5">
        <p className="text-[10px] text-muted-foreground">© Mesob Bingo 2025</p>
      </footer>
    </div>
  );
};

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default LobbyScreen;
