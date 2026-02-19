import type { Deposit, Withdrawal, User, AuditLog, FraudAlert, BingoRoom, Admin } from "@/types/dashboard";

export const currentAdmin: Admin = {
  id: "admin-001",
  name: "Alex Morgan",
  role: "super_admin",
  email: "alex@bingobets.com",
};

export const mockDeposits: Deposit[] = [
  { id: "DEP-001", telegram_id: "891234567", username: "player_king", amount: 500, payment_method: "M-Pesa", transaction_ref: "TXN8834921", screenshot_url: "/placeholder.svg", created_at: "2026-02-11T08:23:00Z", status: "pending", assigned_admin: null },
  { id: "DEP-002", telegram_id: "891234568", username: "lucky_star", amount: 1200, payment_method: "Bank Transfer", transaction_ref: "TXN8834922", screenshot_url: "/placeholder.svg", created_at: "2026-02-11T08:15:00Z", status: "pending", assigned_admin: null },
  { id: "DEP-003", telegram_id: "891234569", username: "bingo_ace", amount: 250, payment_method: "M-Pesa", transaction_ref: "TXN8834923", screenshot_url: "/placeholder.svg", created_at: "2026-02-11T07:50:00Z", status: "under_review", assigned_admin: "admin-002" },
  { id: "DEP-004", telegram_id: "891234570", username: "win_master", amount: 3000, payment_method: "Airtel Money", transaction_ref: "TXN8834924", screenshot_url: "/placeholder.svg", created_at: "2026-02-11T07:30:00Z", status: "approved", assigned_admin: "admin-001" },
  { id: "DEP-005", telegram_id: "891234571", username: "fast_bet", amount: 100, payment_method: "M-Pesa", transaction_ref: "TXN8834925", screenshot_url: "/placeholder.svg", created_at: "2026-02-11T06:45:00Z", status: "rejected", assigned_admin: "admin-001", rejection_reason: "Invalid screenshot" },
];

export const mockWithdrawals: Withdrawal[] = [
  { id: "WDR-001", telegram_id: "891234567", username: "player_king", amount: 200, payment_method: "M-Pesa", account_details: "0712***890", created_at: "2026-02-11T09:10:00Z", status: "pending", assigned_admin: null, user_wallet: 1500, user_total_deposited: 3000, user_total_withdrawn: 800, user_games_played: 42, user_games_won: 12 },
  { id: "WDR-002", telegram_id: "891234572", username: "mega_win", amount: 5000, payment_method: "Bank Transfer", account_details: "ACC***4521", created_at: "2026-02-11T08:55:00Z", status: "pending", assigned_admin: null, user_wallet: 8200, user_total_deposited: 15000, user_total_withdrawn: 6000, user_games_played: 89, user_games_won: 31 },
  { id: "WDR-003", telegram_id: "891234573", username: "cash_out", amount: 800, payment_method: "M-Pesa", account_details: "0723***456", created_at: "2026-02-11T08:20:00Z", status: "under_review", assigned_admin: "admin-001", user_wallet: 1200, user_total_deposited: 2000, user_total_withdrawn: 400, user_games_played: 15, user_games_won: 5 },
];

export const mockUsers: User[] = [
  { id: "usr-001", telegram_id: "891234567", username: "player_king", phone: "+254712345890", main_wallet: 1500, bonus_wallet: 50, total_deposited: 3000, total_withdrawn: 800, deposit_count: 8, games_played: 42, games_won: 12, referral_count: 5, bonus_claimed: true, is_banned: false, phone_verified: true, created_at: "2025-12-01T10:00:00Z", last_active: "2026-02-11T08:23:00Z" },
  { id: "usr-002", telegram_id: "891234568", username: "lucky_star", phone: "+254723456789", main_wallet: 2800, bonus_wallet: 100, total_deposited: 5000, total_withdrawn: 1200, deposit_count: 12, games_played: 67, games_won: 22, referral_count: 11, bonus_claimed: true, is_banned: false, phone_verified: true, created_at: "2025-11-15T14:30:00Z", last_active: "2026-02-11T08:15:00Z" },
  { id: "usr-003", telegram_id: "891234569", username: "bingo_ace", phone: "+254734567890", main_wallet: 450, bonus_wallet: 0, total_deposited: 1500, total_withdrawn: 900, deposit_count: 4, games_played: 28, games_won: 8, referral_count: 2, bonus_claimed: false, is_banned: false, phone_verified: false, created_at: "2026-01-05T09:15:00Z", last_active: "2026-02-11T07:50:00Z" },
  { id: "usr-004", telegram_id: "891234570", username: "win_master", phone: "+254745678901", main_wallet: 6200, bonus_wallet: 200, total_deposited: 12000, total_withdrawn: 5500, deposit_count: 20, games_played: 134, games_won: 45, referral_count: 18, bonus_claimed: true, is_banned: false, phone_verified: true, created_at: "2025-10-20T16:00:00Z", last_active: "2026-02-11T07:30:00Z" },
  { id: "usr-005", telegram_id: "891234574", username: "suspect_user", phone: "+254756789012", main_wallet: 50, bonus_wallet: 0, total_deposited: 200, total_withdrawn: 500, deposit_count: 1, games_played: 3, games_won: 2, referral_count: 45, bonus_claimed: true, is_banned: true, phone_verified: false, created_at: "2026-02-08T22:00:00Z", last_active: "2026-02-10T23:55:00Z" },
];

export const mockAuditLogs: AuditLog[] = [
  { id: "log-001", admin_id: "admin-001", admin_name: "Alex Morgan", action_type: "deposit_approved", target_user: "win_master", amount: 3000, timestamp: "2026-02-11T07:35:00Z", ip_address: "192.168.1.101" },
  { id: "log-002", admin_id: "admin-001", admin_name: "Alex Morgan", action_type: "deposit_rejected", target_user: "fast_bet", amount: 100, timestamp: "2026-02-11T06:50:00Z", ip_address: "192.168.1.101", details: "Invalid screenshot" },
  { id: "log-003", admin_id: "admin-002", admin_name: "Sarah Chen", action_type: "withdrawal_approved", target_user: "mega_win", amount: 2000, timestamp: "2026-02-10T18:20:00Z", ip_address: "192.168.1.102" },
  { id: "log-004", admin_id: "admin-001", admin_name: "Alex Morgan", action_type: "user_banned", target_user: "suspect_user", timestamp: "2026-02-10T14:00:00Z", ip_address: "192.168.1.101", details: "Suspicious referral activity" },
  { id: "log-005", admin_id: "admin-003", admin_name: "James Okafor", action_type: "wallet_adjusted", target_user: "player_king", amount: -50, timestamp: "2026-02-10T11:30:00Z", ip_address: "192.168.1.103", details: "Correction for duplicate credit" },
];

export const mockFraudAlerts: FraudAlert[] = [
  { id: "alert-001", alert_type: "excessive_withdrawals", user_id: "usr-005", username: "suspect_user", telegram_id: "891234574", risk_score: 92, description: "5 withdrawal requests in 24 hours", created_at: "2026-02-10T23:00:00Z", resolved: false },
  { id: "alert-002", alert_type: "withdrawal_exceeds_deposit", user_id: "usr-005", username: "suspect_user", telegram_id: "891234574", risk_score: 88, description: "Withdraw amount 2.5x total deposited", created_at: "2026-02-10T22:30:00Z", resolved: false },
  { id: "alert-003", alert_type: "referral_spike", user_id: "usr-005", username: "suspect_user", telegram_id: "891234574", risk_score: 85, description: "45 referrals in 3 days — suspicious pattern", created_at: "2026-02-09T15:00:00Z", resolved: false },
  { id: "alert-004", alert_type: "duplicate_phone", user_id: "usr-003", username: "bingo_ace", telegram_id: "891234569", risk_score: 60, description: "Phone number linked to 2 other accounts", created_at: "2026-02-09T10:00:00Z", resolved: true },
];

export const mockBingoRooms: BingoRoom[] = [
  { id: "room-001", name: "Bronze Room", entry_fee: 50, min_players: 5, max_players: 20, current_players: 12, countdown_time: 120, winning_percentage: 70, total_pot: 600, expected_payout: 420, commission: 180, status: "active", created_at: "2026-02-11T08:00:00Z" },
  { id: "room-002", name: "Silver Room", entry_fee: 200, min_players: 5, max_players: 15, current_players: 3, countdown_time: 180, winning_percentage: 75, total_pot: 600, expected_payout: 450, commission: 150, status: "waiting", created_at: "2026-02-11T08:30:00Z" },
  { id: "room-003", name: "Gold Room", entry_fee: 1000, min_players: 10, max_players: 30, current_players: 28, countdown_time: 60, winning_percentage: 80, total_pot: 28000, expected_payout: 22400, commission: 5600, status: "active", created_at: "2026-02-11T07:00:00Z" },
];

export const chartDataRevenue = [
  { date: "Feb 5", revenue: 45000, deposits: 52000, withdrawals: 31000 },
  { date: "Feb 6", revenue: 38000, deposits: 48000, withdrawals: 28000 },
  { date: "Feb 7", revenue: 52000, deposits: 61000, withdrawals: 35000 },
  { date: "Feb 8", revenue: 41000, deposits: 50000, withdrawals: 33000 },
  { date: "Feb 9", revenue: 58000, deposits: 68000, withdrawals: 40000 },
  { date: "Feb 10", revenue: 62000, deposits: 75000, withdrawals: 45000 },
  { date: "Feb 11", revenue: 35000, deposits: 42000, withdrawals: 22000 },
];

export const chartDataUsers = [
  { date: "Feb 5", registrations: 28 },
  { date: "Feb 6", registrations: 34 },
  { date: "Feb 7", registrations: 41 },
  { date: "Feb 8", registrations: 22 },
  { date: "Feb 9", registrations: 55 },
  { date: "Feb 10", registrations: 48 },
  { date: "Feb 11", registrations: 19 },
];
