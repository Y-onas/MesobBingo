import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditLogs } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search, ClipboardList, Loader2 } from "lucide-react";

const typeColors: Record<string, string> = {
  deposit_approved: "bg-status-approved/10 text-status-approved",
  deposit_rejected: "bg-status-rejected/10 text-status-rejected",
  withdrawal_approved: "bg-status-approved/10 text-status-approved",
  withdrawal_rejected: "bg-status-rejected/10 text-status-rejected",
  user_banned: "bg-status-rejected/10 text-status-rejected",
  user_unbanned: "bg-status-approved/10 text-status-approved",
  wallet_adjusted: "bg-primary/10 text-primary",
  bonus_reset: "bg-accent/10 text-accent",
  phone_verified: "bg-status-approved/10 text-status-approved",
  fraud_alert_resolved: "bg-accent/10 text-accent",
};

export default function AuditLogPage() {
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", search],
    queryFn: () => fetchAuditLogs(search || undefined),
    refetchInterval: 20000,
  });

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Track all admin actions</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by admin, action, or user..."
          className="pl-10 bg-muted border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {logs.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 p-12">
          <ClipboardList className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-semibold">No Logs Yet</p>
          <p className="text-sm text-muted-foreground">Admin actions will appear here</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{log.admin_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${typeColors[log.action_type] || "bg-muted text-muted-foreground"}`}>
                        {log.action_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{log.target_user || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.amount ? `${Number(log.amount).toLocaleString()} ብር` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.ip_address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
