// ─── Mesob Bingo Admin API Client ────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_KEY = import.meta.env.VITE_API_KEY || 'mesob-admin-secret';

// Admin identity (stored in localStorage for audit tracking)
const getAdminId = () => localStorage.getItem('mesob_admin_id') || '1';
const getAdminName = () => localStorage.getItem('mesob_admin_name') || 'Admin';

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': API_KEY,
            'X-Admin-Id': getAdminId(),
            'X-Admin-Name': getAdminName(),
            ...options.headers,
        },
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'API request failed');
    }

    return res.json();
}

// ─── Stats ───────────────────────────────────────────────────────────
export const fetchStats = () => apiRequest<{
    totalUsers: number;
    activeUsers: number;
    depositsToday: number;
    withdrawalsToday: number;
    platformProfit: number;
    pendingDeposits: number;
    pendingWithdrawals: number;
}>('/api/stats');

export const fetchCharts = () => apiRequest<{
    revenue: { date: string; deposits: number; withdrawals: number }[];
    registrations: { date: string; registrations: number }[];
}>('/api/stats/charts');

// ─── Deposits ────────────────────────────────────────────────────────
export const fetchDeposits = (status?: string) =>
    apiRequest<any[]>(`/api/deposits${status && status !== 'all' ? `?status=${status}` : ''}`);

export const reviewDeposit = (id: number) =>
    apiRequest<any>(`/api/deposits/${id}/review`, { method: 'POST' });

export const approveDeposit = (id: number) =>
    apiRequest<any>(`/api/deposits/${id}/approve`, { method: 'POST' });

export const rejectDeposit = (id: number, reason: string) =>
    apiRequest<any>(`/api/deposits/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });

// ─── Withdrawals ─────────────────────────────────────────────────────
export const fetchWithdrawals = (status?: string) =>
    apiRequest<any[]>(`/api/withdrawals${status && status !== 'all' ? `?status=${status}` : ''}`);

export const reviewWithdrawal = (id: number) =>
    apiRequest<any>(`/api/withdrawals/${id}/review`, { method: 'POST' });

export const approveWithdrawal = (id: number) =>
    apiRequest<any>(`/api/withdrawals/${id}/approve`, { method: 'POST' });

export const rejectWithdrawal = (id: number, reason: string) =>
    apiRequest<any>(`/api/withdrawals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });

// ─── Users ───────────────────────────────────────────────────────────
export const fetchUsers = (search?: string) =>
    apiRequest<any[]>(`/api/users${search ? `?search=${encodeURIComponent(search)}` : ''}`);

export const fetchUser = (telegramId: string) =>
    apiRequest<any>(`/api/users/${telegramId}`);

export const toggleBanUser = (telegramId: string) =>
    apiRequest<any>(`/api/users/${telegramId}/ban`, { method: 'POST' });

export const adjustWallet = (telegramId: string, amount: number, reason: string) =>
    apiRequest<any>(`/api/users/${telegramId}/adjust-wallet`, {
        method: 'POST',
        body: JSON.stringify({ amount, reason }),
    });

export const resetBonus = (telegramId: string) =>
    apiRequest<any>(`/api/users/${telegramId}/reset-bonus`, { method: 'POST' });

export const verifyPhone = (telegramId: string) =>
    apiRequest<any>(`/api/users/${telegramId}/verify-phone`, { method: 'POST' });

// ─── Audit Logs ──────────────────────────────────────────────────────
export const fetchAuditLogs = (search?: string) =>
    apiRequest<any[]>(`/api/audit-logs${search ? `?search=${encodeURIComponent(search)}` : ''}`);

// ─── Fraud Alerts ────────────────────────────────────────────────────
export const fetchFraudAlerts = () => apiRequest<any[]>('/api/fraud-alerts');

export const resolveFraudAlert = (id: number) =>
    apiRequest<any>(`/api/fraud-alerts/${id}/resolve`, { method: 'POST' });

// ─── Game Rooms ──────────────────────────────────────────────────────
export const fetchGameRooms = () => apiRequest<any[]>('/api/game-rooms');

export const createGameRoom = (data: {
    name: string;
    entry_fee: number;
    min_players: number;
    max_players: number;
    countdown_time: number;
    winning_percentage: number;
}) =>
    apiRequest<any>('/api/game-rooms', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const updateGameRoom = (id: number, data: {
    name?: string;
    entry_fee?: number;
    min_players?: number;
    max_players?: number;
    countdown_time?: number;
    winning_percentage?: number;
    status?: string;
}) =>
    apiRequest<any>(`/api/game-rooms/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });

export const deleteGameRoom = (id: number) =>
    apiRequest<any>(`/api/game-rooms/${id}`, {
        method: 'DELETE',
    });
