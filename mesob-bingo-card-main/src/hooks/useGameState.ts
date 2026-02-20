import { useReducer, useCallback, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────

export interface GameRoom {
    id: number;
    name: string;
    entryFee: number;
    minPlayers: number;
    maxPlayers: number;
    currentPlayers: number;
    countdownTime: number;
    winningPercentage: number;
    totalPot: number;
    status: string;
    gameId: number | null;
    startsIn: number | null;
}

export interface GameState {
    gameId: number | null;
    roomId: number | null;
    roomName: string;
    entryFee: number;
    status: string;
    playerCount: number;
    maxPlayers: number;
    totalPot: number;
    calledNumbers: number[];
    callCount: number;
    countdownRemaining: number | null;
    currentCall: { letter: string; number: number } | null;
}

export interface Balance {
    mainWallet: number;
    playWallet: number;
    total: number;
}

export interface WinnerInfo {
    winnerId: number;
    winnerName: string;
    boardNumber: number;
    winAmount: number;
    pattern: string;
    winningLine: number[];
}

interface AppState {
    screen: 'lobby' | 'board_selection' | 'gameplay';
    rooms: GameRoom[];
    currentGame: GameState | null;
    boardNumber: number | null;
    boardContent: number[][] | null;
    availableBoards: number[];
    balance: Balance;
    markedNumbers: Set<number>;
    winner: WinnerInfo | null;
    countdownSeconds: number | null;
    error: string | null;
}

type Action =
    | { type: 'SET_ROOMS'; rooms: GameRoom[] }
    | { type: 'ROOM_UPDATE'; data: any }
    | { type: 'GAME_JOINED'; data: any }
    | { type: 'BOARD_ASSIGNED'; data: any }
    | { type: 'BOARD_UNAVAILABLE'; message: string }
    | { type: 'AVAILABLE_BOARDS'; boards: number[] }
    | { type: 'COUNTDOWN_START'; seconds: number }
    | { type: 'COUNTDOWN_TICK'; seconds: number }
    | { type: 'GAME_STARTED'; data: any }
    | { type: 'NUMBER_CALLED'; data: any }
    | { type: 'GAME_WON'; data: WinnerInfo }
    | { type: 'GAME_ENDED'; data: any }
    | { type: 'PLAYER_JOINED'; data: any }
    | { type: 'PLAYER_LEFT'; data: any }
    | { type: 'BALANCE_UPDATE'; data: Balance }
    | { type: 'MARK_NUMBER'; number: number }
    | { type: 'BINGO_RESULT'; data: any }
    | { type: 'SET_ERROR'; error: string }
    | { type: 'CLEAR_ERROR' }
    | { type: 'GO_TO_LOBBY' }
    | { type: 'LEAVE_GAME' };

// ─── Reducer ────────────────────────────────────────────────────────

const STORAGE_KEY = 'bingo_marked_numbers';

// Load marked numbers from localStorage
const loadMarkedNumbers = (gameId: number | null): Set<number> => {
    if (!gameId) return new Set();
    try {
        const stored = localStorage.getItem(`${STORAGE_KEY}_${gameId}`);
        if (stored) {
            return new Set(JSON.parse(stored));
        }
    } catch (error) {
        console.error('Failed to load marked numbers:', error);
    }
    return new Set();
};

// Save marked numbers to localStorage
const saveMarkedNumbers = (gameId: number | null, markedNumbers: Set<number>) => {
    if (!gameId) return;
    try {
        localStorage.setItem(`${STORAGE_KEY}_${gameId}`, JSON.stringify(Array.from(markedNumbers)));
    } catch (error) {
        console.error('Failed to save marked numbers:', error);
    }
};

// Clear marked numbers from localStorage
const clearMarkedNumbers = (gameId: number | null) => {
    if (!gameId) return;
    try {
        localStorage.removeItem(`${STORAGE_KEY}_${gameId}`);
    } catch (error) {
        console.error('Failed to clear marked numbers:', error);
    }
};

const initialState: AppState = {
    screen: 'lobby',
    rooms: [],
    currentGame: null,
    boardNumber: null,
    boardContent: null,
    availableBoards: [],
    balance: { mainWallet: 0, playWallet: 0, total: 0 },
    markedNumbers: new Set(),
    winner: null,
    countdownSeconds: null,
    error: null,
};

function gameReducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'SET_ROOMS':
            return { ...state, rooms: action.rooms };

        case 'ROOM_UPDATE': {
            const rooms = state.rooms.map(r =>
                r.id === action.data.id ? { ...r, ...action.data } : r
            );
            return { ...state, rooms };
        }

        case 'GAME_JOINED':
            if (action.data.reconnect && action.data.boardNumber) {
                // Reconnect — go straight to gameplay with board content
                // Load marked numbers from localStorage
                const gameId = action.data.game?.gameId;
                return {
                    ...state,
                    screen: 'gameplay',
                    currentGame: action.data.game,
                    boardNumber: action.data.boardNumber,
                    boardContent: action.data.boardContent || null,
                    markedNumbers: loadMarkedNumbers(gameId),
                    winner: null,
                };
            }
            return {
                ...state,
                screen: 'board_selection',
                currentGame: action.data.game,
                availableBoards: action.data.availableBoards || [],
                winner: null,
                markedNumbers: new Set(),
            };

        case 'BOARD_ASSIGNED':
            return {
                ...state,
                screen: 'gameplay',
                boardNumber: action.data.boardNumber,
                boardContent: action.data.boardContent,
                currentGame: action.data.gameState || state.currentGame,
                markedNumbers: new Set(),
            };

        case 'BOARD_UNAVAILABLE':
            return { ...state, error: action.message };

        case 'AVAILABLE_BOARDS':
            return { ...state, availableBoards: action.boards };

        case 'COUNTDOWN_START':
            return {
                ...state,
                countdownSeconds: action.seconds,
                currentGame: state.currentGame
                    ? { ...state.currentGame, status: 'countdown' }
                    : state.currentGame,
            };

        case 'COUNTDOWN_TICK':
            return {
                ...state,
                countdownSeconds: action.seconds,
                currentGame: state.currentGame
                    ? { ...state.currentGame, countdownRemaining: action.seconds }
                    : state.currentGame,
            };

        case 'GAME_STARTED':
            return {
                ...state,
                countdownSeconds: null,
                currentGame: state.currentGame
                    ? { ...state.currentGame, status: 'playing', playerCount: action.data.playerCount, totalPot: action.data.totalPot }
                    : state.currentGame,
            };

        case 'NUMBER_CALLED':
            return {
                ...state,
                currentGame: state.currentGame
                    ? {
                        ...state.currentGame,
                        calledNumbers: action.data.calledNumbers,
                        callCount: action.data.callOrder,
                        currentCall: { letter: action.data.letter, number: action.data.number },
                    }
                    : state.currentGame,
            };

        case 'GAME_WON':
            return { ...state, winner: action.data };

        case 'GAME_ENDED':
            return {
                ...state,
                currentGame: state.currentGame
                    ? { ...state.currentGame, status: 'completed' }
                    : state.currentGame,
            };

        case 'PLAYER_JOINED':
        case 'PLAYER_LEFT':
            return {
                ...state,
                currentGame: state.currentGame
                    ? { ...state.currentGame, playerCount: action.data.playerCount, totalPot: action.data.totalPot }
                    : state.currentGame,
            };

        case 'BALANCE_UPDATE':
            return { ...state, balance: action.data };

        case 'MARK_NUMBER': {
            const newMarked = new Set(state.markedNumbers);
            if (newMarked.has(action.number)) {
                newMarked.delete(action.number);
            } else {
                newMarked.add(action.number);
            }
            // Save to localStorage
            saveMarkedNumbers(state.currentGame?.gameId || null, newMarked);
            return { ...state, markedNumbers: newMarked };
        }

        case 'BINGO_RESULT':
            if (!action.data.success) {
                return { ...state, error: action.data.error || 'Invalid BINGO claim' };
            }
            return state;

        case 'SET_ERROR':
            return { ...state, error: action.error };

        case 'CLEAR_ERROR':
            return { ...state, error: null };

        case 'GO_TO_LOBBY':
            // Clear marked numbers from localStorage
            clearMarkedNumbers(state.currentGame?.gameId || null);
            return {
                ...state,
                screen: 'lobby',
                currentGame: null,
                boardNumber: null,
                boardContent: null,
                availableBoards: [],
                markedNumbers: new Set(),
                winner: null,
                countdownSeconds: null,
                error: null,
            };

        case 'LEAVE_GAME':
            // Clear marked numbers from localStorage
            clearMarkedNumbers(state.currentGame?.gameId || null);
            return {
                ...state,
                screen: 'lobby',
                currentGame: null,
                boardNumber: null,
                boardContent: null,
                availableBoards: [],
                markedNumbers: new Set(),
                winner: null,
                countdownSeconds: null,
            };

        default:
            return state;
    }
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useGameState() {
    const [state, dispatch] = useReducer(gameReducer, initialState);

    return { state, dispatch };
}
