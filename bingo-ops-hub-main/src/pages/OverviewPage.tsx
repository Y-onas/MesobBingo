import { useQuery } from "@tanstack/react-query";
import {
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Clock,
  Gamepad2,
  Activity,
} from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { fetchStats, fetchCharts } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function OverviewPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 15000, // auto-refresh every 15s
  });

  const { data: charts } = useQuery({
    queryKey: ["charts"],
    queryFn: fetchCharts,
    refetchInterval: 60000,
  });

  const fmt = (v: number) => v?.toLocaleString() ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground">Real-time platform monitoring</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Users" value={statsLoading ? "…" : fmt(stats?.totalUsers ?? 0)} icon={Users} />
        <KpiCard title="Active Now" value={statsLoading ? "…" : fmt(stats?.activeUsers ?? 0)} icon={Activity} accentColor="bg-status-approved/10 text-status-approved" />
        <KpiCard title="Deposits Today" value={statsLoading ? "…" : `${fmt(stats?.depositsToday ?? 0)} ብር`} icon={ArrowDownCircle} />
        <KpiCard title="Withdrawals Today" value={statsLoading ? "…" : `${fmt(stats?.withdrawalsToday ?? 0)} ብር`} icon={ArrowUpCircle} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Platform Profit" value={statsLoading ? "…" : `${fmt(stats?.platformProfit ?? 0)} ብር`} icon={TrendingUp} accentColor="bg-primary/10 text-primary" />
        <KpiCard title="Pending Deposits" value={statsLoading ? "…" : fmt(stats?.pendingDeposits ?? 0)} icon={Clock} accentColor="bg-[hsl(var(--status-pending)/.1)] text-status-pending" />
        <KpiCard title="Pending Withdrawals" value={statsLoading ? "…" : fmt(stats?.pendingWithdrawals ?? 0)} icon={Clock} accentColor="bg-[hsl(var(--status-pending)/.1)] text-status-pending" />
        <KpiCard title="Active Rooms" value="—" icon={Gamepad2} accentColor="bg-accent/10 text-accent" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <div className="glass-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Deposits vs Withdrawals (7 days)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={charts?.revenue || []}>
              <defs>
                <linearGradient id="fillDeposits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillWithdrawals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 16% 18%)" />
              <XAxis dataKey="date" tick={{ fill: "hsl(215 14% 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 14% 50%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(220 20% 10%)", border: "1px solid hsl(220 16% 18%)", borderRadius: 8, color: "hsl(210 20% 92%)" }}
                formatter={(value: number) => [`${value.toLocaleString()} ብር`, ""]}
              />
              <Area type="monotone" dataKey="deposits" stroke="hsl(142 71% 45%)" fill="url(#fillDeposits)" strokeWidth={2} name="Deposits" />
              <Area type="monotone" dataKey="withdrawals" stroke="hsl(0 72% 51%)" fill="url(#fillWithdrawals)" strokeWidth={2} name="Withdrawals" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* User Registrations */}
        <div className="glass-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            New User Registrations (7 days)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts?.registrations || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 16% 18%)" />
              <XAxis dataKey="date" tick={{ fill: "hsl(215 14% 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 14% 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(220 20% 10%)", border: "1px solid hsl(220 16% 18%)", borderRadius: 8, color: "hsl(210 20% 92%)" }}
              />
              <Bar dataKey="registrations" fill="hsl(43 96% 56%)" radius={[4, 4, 0, 0]} name="Registrations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
