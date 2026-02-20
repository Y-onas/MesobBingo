import { cn } from "@/lib/utils";
import type { Deposit, Withdrawal } from "@/types/dashboard";

type Status = Deposit["status"] | Withdrawal["status"];

const statusLabels: Record<Status, string> = {
  pending: "Pending",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        status === "pending" && "status-pending",
        status === "under_review" && "status-review",
        status === "approved" && "status-approved",
        status === "rejected" && "status-rejected"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "pending" && "bg-status-pending animate-pulse-soft",
          status === "under_review" && "bg-status-review animate-pulse-soft",
          status === "approved" && "bg-status-approved",
          status === "rejected" && "bg-status-rejected"
        )}
      />
      {statusLabels[status]}
    </span>
  );
}
