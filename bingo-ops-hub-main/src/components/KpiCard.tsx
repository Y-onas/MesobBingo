import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  accentColor?: string;
}

export function KpiCard({ title, value, icon: Icon, trend, trendUp, className, accentColor }: KpiCardProps) {
  return (
    <div className={cn("kpi-card animate-slide-in", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
          {trend && (
            <p className={cn("text-xs font-medium", trendUp ? "text-status-approved" : "text-status-rejected")}>
              {trendUp ? "↑" : "↓"} {trend}
            </p>
          )}
        </div>
        <div className={cn("rounded-lg p-2.5", accentColor || "bg-primary/10")}>
          <Icon className={cn("h-5 w-5", accentColor ? "text-current" : "text-primary")} />
        </div>
      </div>
    </div>
  );
}
