import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFraudAlerts, resolveFraudAlert } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const riskColor = (score: number) => {
  if (score >= 80) return "text-status-rejected bg-status-rejected/10";
  if (score >= 50) return "text-status-pending bg-status-pending/10";
  return "text-status-approved bg-status-approved/10";
};

export default function FraudAlertsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: alerts = [], isLoading, isError, error } = useQuery({
    queryKey: ["fraud-alerts"],
    queryFn: fetchFraudAlerts,
    refetchInterval: 20000,
  });

  const resolveMut = useMutation({
    mutationFn: (id: number) => resolveFraudAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud-alerts"] });
      toast({ title: "Alert resolved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fraud Alerts</h1>
          <p className="text-sm text-muted-foreground">Suspicious activity monitoring</p>
        </div>
        <div className="glass-card flex flex-col items-center gap-3 p-12">
          <AlertTriangle className="h-12 w-12 text-status-rejected" />
          <p className="text-lg font-semibold">Unable to Load Fraud Alerts</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again later."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["fraud-alerts"] })}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fraud Alerts</h1>
        <p className="text-sm text-muted-foreground">Suspicious activity monitoring</p>
      </div>

      {alerts.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 p-12">
          <ShieldCheck className="h-12 w-12 text-status-approved" />
          <p className="text-lg font-semibold">All Clear</p>
          <p className="text-sm text-muted-foreground">No fraud alerts at this time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert: any) => (
            <div key={alert.id} className={cn("glass-card flex items-start gap-4 p-4", alert.resolved && "opacity-50")}>
              <div className={cn("mt-0.5 rounded-full p-2", riskColor(alert.risk_score))}>
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider">{alert.alert_type.replace(/_/g, " ")}</span>
                  <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold", riskColor(alert.risk_score))}>
                    Risk: {alert.risk_score}%
                  </span>
                </div>
                <p className="text-sm">{alert.description}</p>
                <p className="text-xs text-muted-foreground">
                  User: <span className="font-mono">{alert.username}</span> ({alert.telegram_id}) · {new Date(alert.created_at).toLocaleString()}
                </p>
              </div>
              {!alert.resolved && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => resolveMut.mutate(alert.id)}
                  disabled={resolveMut.isPending}
                >
                  Resolve
                </Button>
              )}
              {alert.resolved && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3 w-3" />Resolved</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
