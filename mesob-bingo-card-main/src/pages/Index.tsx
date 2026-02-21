import { useEffect, useState } from "react";
import LobbyScreen from "@/screens/LobbyScreen";
import BoardSelectionScreen from "@/screens/BoardSelectionScreen";
import GamePlayScreen from "@/screens/GamePlayScreen";
import WinnerModal from "@/components/WinnerModal";
import { useSocket } from "@/hooks/useSocket";
import { useGameState } from "@/hooks/useGameState";
import "../telegram-init";

const SOCKET_EVENTS = {
  GET_ROOMS: 'get_rooms',
  JOIN_GAME: 'join_game',
  SELECT_BOARD: 'select_board',
  CLAIM_BINGO: 'claim_bingo',
  LEAVE_GAME: 'leave_game',
  GET_BALANCE: 'get_balance',
  CHECK_ACTIVE_GAME: 'check_active_game',
  ROOMS_LIST: 'rooms_list',
  ROOM_UPDATE: 'room_update',
  GAME_JOINED: 'game_joined',
  BOARD_ASSIGNED: 'board_assigned',
  BOARD_UNAVAILABLE: 'board_unavailable',
  AVAILABLE_BOARDS: 'available_boards',
  COUNTDOWN_START: 'countdown_start',
  COUNTDOWN_TICK: 'countdown_tick',
  GAME_STARTED: 'game_started',
  NUMBER_CALLED: 'number_called',
  BINGO_RESULT: 'bingo_result',
  GAME_WON: 'game_won',
  GAME_ENDED: 'game_ended',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  BALANCE_UPDATE: 'balance_update',
  FORCE_LEAVE_GAME: 'force_leave_game',
  ERROR: 'error_msg',
};

const Index = () => {
  const { status, emit, on, off } = useSocket();
  const { state, dispatch } = useGameState();
  
  // Voice state at parent level to persist across renders
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('bingoVoiceEnabled');
    const initialValue = saved === 'true';
    if (import.meta.env.DEV) {
      console.log('Index.tsx - Initial voice state from localStorage:', saved, '-> boolean:', initialValue);
    }
    return initialValue;
  });

  // Persist voice preference whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('bingoVoiceEnabled', String(voiceEnabled));
      if (import.meta.env.DEV) {
        console.log('Index.tsx - Voice state persisted to localStorage:', voiceEnabled);
      }
    } catch (e) {
      console.error('Failed to save voice setting to localStorage', e);
    }
  }, [voiceEnabled]);

  // ─── Wire socket events to game state ───────────────────────────
  useEffect(() => {
    const handlers: Record<string, (...args: any[]) => void> = {
      [SOCKET_EVENTS.ROOMS_LIST]: (data: any) => dispatch({ type: 'SET_ROOMS', rooms: data.rooms }),
      [SOCKET_EVENTS.ROOM_UPDATE]: (data: any) => dispatch({ type: 'ROOM_UPDATE', data }),
      [SOCKET_EVENTS.GAME_JOINED]: (data: any) => dispatch({ type: 'GAME_JOINED', data }),
      [SOCKET_EVENTS.BOARD_ASSIGNED]: (data: any) => dispatch({ type: 'BOARD_ASSIGNED', data }),
      [SOCKET_EVENTS.BOARD_UNAVAILABLE]: (data: any) => dispatch({ type: 'BOARD_UNAVAILABLE', message: data.message }),
      [SOCKET_EVENTS.AVAILABLE_BOARDS]: (data: any) => dispatch({ type: 'AVAILABLE_BOARDS', boards: data.boards }),
      [SOCKET_EVENTS.COUNTDOWN_START]: (data: any) => dispatch({ type: 'COUNTDOWN_START', seconds: data.seconds }),
      [SOCKET_EVENTS.COUNTDOWN_TICK]: (data: any) => dispatch({ type: 'COUNTDOWN_TICK', seconds: data.seconds }),
      [SOCKET_EVENTS.GAME_STARTED]: (data: any) => dispatch({ type: 'GAME_STARTED', data }),
      [SOCKET_EVENTS.NUMBER_CALLED]: (data: any) => dispatch({ type: 'NUMBER_CALLED', data }),
      [SOCKET_EVENTS.BINGO_RESULT]: (data: any) => dispatch({ type: 'BINGO_RESULT', data }),
      [SOCKET_EVENTS.GAME_WON]: (data: any) => dispatch({ type: 'GAME_WON', data }),
      [SOCKET_EVENTS.GAME_ENDED]: (data: any) => dispatch({ type: 'GAME_ENDED', data }),
      [SOCKET_EVENTS.PLAYER_JOINED]: (data: any) => dispatch({ type: 'PLAYER_JOINED', data }),
      [SOCKET_EVENTS.PLAYER_LEFT]: (data: any) => dispatch({ type: 'PLAYER_LEFT', data }),
      [SOCKET_EVENTS.BALANCE_UPDATE]: (data: any) => {
        if (import.meta.env.DEV) {
          console.log('BALANCE_UPDATE received:', data);
        }
        dispatch({ type: 'BALANCE_UPDATE', data });
      },
      [SOCKET_EVENTS.FORCE_LEAVE_GAME]: (data: any) => {
        // Player was removed from game - show error and go to lobby
        dispatch({ type: 'SET_ERROR', error: data.message });
        dispatch({ type: 'LEAVE_GAME' });
        emit(SOCKET_EVENTS.GET_ROOMS);
        emit(SOCKET_EVENTS.GET_BALANCE);
      },
      [SOCKET_EVENTS.ERROR]: (data: any) => dispatch({ type: 'SET_ERROR', error: data.message }),
    };

    // Register all handlers
    for (const [event, handler] of Object.entries(handlers)) {
      on(event, handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        off(event, handler);
      }
    };
  }, [on, off, dispatch]);

  // ─── Fetch rooms + balance on connect ───────────────────────────
  useEffect(() => {
    if (status === 'connected') {
      // Check if user is already in an active game
      emit(SOCKET_EVENTS.CHECK_ACTIVE_GAME);
      emit(SOCKET_EVENTS.GET_ROOMS);
      emit(SOCKET_EVENTS.GET_BALANCE);
    }
  }, [status, emit]);

  // ─── Clear errors after 3 seconds ──────────────────────────────
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => dispatch({ type: 'CLEAR_ERROR' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.error, dispatch]);

  // ─── Actions ───────────────────────────────────────────────────
  const handleSelectGame = (roomId: number) => {
    emit(SOCKET_EVENTS.JOIN_GAME, { roomId });
  };

  const handleSelectBoard = (boardNumber: number) => {
    if (state.currentGame?.gameId) {
      emit(SOCKET_EVENTS.SELECT_BOARD, {
        gameId: state.currentGame.gameId,
        boardNumber,
      });
    }
  };

  const handleClaimBingo = () => {
    if (state.currentGame?.gameId) {
      emit(SOCKET_EVENTS.CLAIM_BINGO, {
        gameId: state.currentGame.gameId,
        markedNumbers: Array.from(state.markedNumbers), // Send marked numbers array
      });
    }
  };

  const handleLeaveGame = () => {
    if (state.currentGame?.gameId) {
      emit(SOCKET_EVENTS.LEAVE_GAME, {
        gameId: state.currentGame.gameId,
      });
    }
    dispatch({ type: 'LEAVE_GAME' });
  };

  const handleMarkNumber = (number: number) => {
    dispatch({ type: 'MARK_NUMBER', number });
  };

  const handleCloseWinner = () => {
    dispatch({ type: 'GO_TO_LOBBY' });
    emit(SOCKET_EVENTS.GET_ROOMS);
    emit(SOCKET_EVENTS.GET_BALANCE);
  };

  const handleRefreshBalance = () => {
    if (import.meta.env.DEV) {
      console.log('handleRefreshBalance called - emitting GET_BALANCE');
    }
    emit(SOCKET_EVENTS.GET_BALANCE);
  };

  const handleRefreshGame = () => {
    // Refresh balance and check for active game (reconnect if needed)
    if (import.meta.env.DEV) {
      console.log('Refresh button clicked - emitting GET_BALANCE and CHECK_ACTIVE_GAME');
    }
    emit(SOCKET_EVENTS.GET_BALANCE);
    emit(SOCKET_EVENTS.CHECK_ACTIVE_GAME);
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Error toast */}
      {state.error && (
        <div className="fixed top-2 left-2 right-2 z-50 bg-destructive text-destructive-foreground px-3 py-2 rounded-lg text-xs font-semibold shadow-lg animate-in fade-in">
          {state.error}
        </div>
      )}

      {/* Connection status indicator */}
      {status !== 'connected' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black text-center py-1 text-[10px] font-semibold">
          {status === 'connecting' ? '🔄 Connecting...' : status === 'error' ? '❌ Connection error — retrying...' : '⚠️ Disconnected — reconnecting...'}
        </div>
      )}

      {/* Screens */}
      {state.screen === 'lobby' && (
        <LobbyScreen
          rooms={state.rooms}
          balance={state.balance.total}
          onSelectGame={handleSelectGame}
          onRefreshBalance={handleRefreshBalance}
          connectionStatus={status}
        />
      )}

      {state.screen === 'board_selection' && state.currentGame && (
        <BoardSelectionScreen
          game={state.currentGame}
          availableBoards={state.availableBoards}
          balance={state.balance.total}
          countdownSeconds={state.countdownSeconds}
          onSelectBoard={handleSelectBoard}
          onBack={handleLeaveGame}
          onRefreshBalance={handleRefreshBalance}
        />
      )}

      {state.screen === 'gameplay' && state.currentGame && state.boardContent && (
        <GamePlayScreen
          game={state.currentGame}
          boardContent={state.boardContent}
          boardNumber={state.boardNumber!}
          balance={state.balance.total}
          markedNumbers={state.markedNumbers}
          onMarkNumber={handleMarkNumber}
          onClaimBingo={handleClaimBingo}
          onRefreshBalance={handleRefreshGame}
          onLeave={handleLeaveGame}
          voiceEnabled={voiceEnabled}
          onVoiceToggle={setVoiceEnabled}
        />
      )}

      {/* Winner Modal */}
      {state.winner && (
        <WinnerModal
          isOpen={!!state.winner}
          winnerName={state.winner.winnerName}
          amount={state.winner.winAmount}
          onClose={handleCloseWinner}
          onPlayAgain={handleCloseWinner}
        />
      )}
    </div>
  );
};

export default Index;
