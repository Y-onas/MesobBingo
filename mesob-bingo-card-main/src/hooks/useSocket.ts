import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getTelegramInitData, getServerUrl, isTelegramWebApp } from '../telegram-init';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseSocketReturn {
    socket: Socket | null;
    status: ConnectionStatus;
    emit: (event: string, data?: any) => void;
    on: (event: string, handler: (...args: any[]) => void) => void;
    off: (event: string, handler?: (...args: any[]) => void) => void;
}

export function useSocket(): UseSocketReturn {
    const socketRef = useRef<Socket | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>('connecting');

    useEffect(() => {
        const serverUrl = getServerUrl();
        let initData = getTelegramInitData();

        // Dev mode: use dev token only in development
        const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV;
        if (!initData && !isTelegramWebApp() && isDev) {
            initData = 'dev_123456789';
        }

        const socket = io(serverUrl, {
            auth: { initData },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            timeout: 30000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Socket.IO connected:', socket.id);
            setStatus('connected');
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket.IO disconnected:', reason);
            setStatus('disconnected');
        });

        socket.on('connect_error', (err) => {
            console.error('Socket.IO connection error:', err.message);
            setStatus('error');
        });

        return () => {
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    const emit = useCallback((event: string, data?: any) => {
        if (socketRef.current?.connected) {
            if (import.meta.env.DEV) {
                console.log(`[Socket] Emitting event: ${event}`, data);
            }
            socketRef.current.emit(event, data);
        } else {
            const reason = socketRef.current == null ? 'no socket' : `socket state: ${socketRef.current.connected}`;
            console.warn(`[Socket] Cannot emit ${event} - socket not connected (${reason})`);
        }
    }, []);

    const on = useCallback((event: string, handler: (...args: any[]) => void) => {
        socketRef.current?.on(event, handler);
    }, []);

    const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
        if (handler) {
            socketRef.current?.off(event, handler);
        } else {
            socketRef.current?.removeAllListeners(event);
        }
    }, []);

    return {
        socket: socketRef.current,
        status,
        emit,
        on,
        off,
    };
}
