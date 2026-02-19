export interface Deposit {
  id: string;
  telegram_id: string;
  username: string;
  amount: number;
  payment_method: string;
  transaction_ref: string;
  screenshot_url: string;
  sms_text: string;
  created_at: string;
  status: "pending" | "under_review" | "approved" | "rejected";
  assigned_admin: string | null;
  rejection_reason?: string;
}

export interface Withdrawal {
  id: string;
  telegram_id: string;
  username: string;
  amount: number;
  payment_method: string;
  account_details: string;
  created_at: string;
  status: "pending" | "under_review" | "approved" | "rejected";
  assigned_admin: string | null;
  rejection_reason?: string;
  user_wallet: number;
  user_total_deposited: number;
  user_total_withdrawn: number;
  user_games_played: number;
  user_games_won: number;
}

export interface User {
  id: string;
  telegram_id: string;
  username: string;
  phone: string;
  main_wallet: number;
  bonus_wallet: number;
  total_deposited: number;
  total_withdrawn: number;
  deposit_count: number;
  games_played: number;
  games_won: number;
  referral_count: number;
  bonus_claimed: boolean;
  is_banned: boolean;
  phone_verified: boolean;
  created_at: string;
  last_active: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_name: string;
  action_type: string;
  target_user: string;
  amount?: number;
  timestamp: string;
  ip_address: string;
  details?: string;
}

export interface FraudAlert {
  id: string;
  alert_type: string;
  user_id: string;
  username: string;
  telegram_id: string;
  risk_score: number;
  description: string;
  created_at: string;
  resolved: boolean;
}

export interface BingoRoom {
  id: string;
  name: string;
  entry_fee: number;
  min_players: number;
  max_players: number;
  current_players: number;
  countdown_time: number;
  winning_percentage: number;
  total_pot: number;
  expected_payout: number;
  commission: number;
  status: "waiting" | "active" | "completed";
  created_at: string;
}

export type AdminRole = "super_admin" | "finance_admin" | "support_admin";

export interface Admin {
  id: string;
  name: string;
  role: AdminRole;
  email: string;
}
