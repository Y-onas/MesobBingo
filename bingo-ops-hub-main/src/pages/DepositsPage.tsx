import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDeposits, reviewDeposit, approveDeposit, rejectDeposit } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import type { Deposit } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Eye, Lock, CheckCircle2, XCircle, Image, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ADMIN_ID = () => localStorage.getItem("mesob_admin_id") || "admin-001";

export default function DepositsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [filter, setFilter] = useState<Deposit["status"] | "all">("all");

  const { data: deposits = [], isLoading } = useQuery({
    queryKey: ["deposits"],
    queryFn: () => fetchDeposits(),
    refetchInterval: 10000,
  });

  const filtered = filter === "all" ? deposits : deposits.filter((d: any) => d.status === filter);

  const reviewMutation = useMutation({
    mutationFn: (id: number) => reviewDeposit(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["deposits"] }); toast({ title: "Deposit locked for review" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveDeposit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setShowApproveDialog(false);
      setSelectedDeposit(null);
      toast({ title: "Deposit approved ✓" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectDeposit(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      setShowRejectDialog(false);
      setRejectReason("");
      setSelectedDeposit(null);
      toast({ title: "Deposit rejected" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canReview = (d: any) => d.status === "pending";
  const canApproveReject = (d: any) => d.status === "under_review" && d.assigned_admin === ADMIN_ID();
  const isLocked = (d: any) => d.status === "under_review" && d.assigned_admin && d.assigned_admin !== ADMIN_ID();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deposit Management</h1>
        <p className="text-sm text-muted-foreground">Review and approve user deposits</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "pending", "under_review", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              filter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {s === "all" ? "All" : s === "under_review" ? "Under Review" : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && (
              <span className="ml-1.5 text-[10px] opacity-70">
                ({deposits.filter((d: any) => d.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ref</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">SMS/Screenshot</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d: any) => (
                <tr key={d.id} className={cn("border-b border-border/50 transition-colors hover:bg-muted/20", isLocked(d) && "opacity-60")}>
                  <td className="px-4 py-3 font-mono text-xs">{d.id}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{d.username}</p>
                      <p className="text-xs text-muted-foreground">{d.telegram_id}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold">{Number(d.amount).toLocaleString()} ብር</td>
                  <td className="px-4 py-3 text-xs">{d.payment_method}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.transaction_ref}</td>
                  <td className="px-4 py-3">
                    {d.sms_text ? (
                      <button
                        onClick={() => { setSelectedDeposit(d); setShowScreenshot(true); }}
                        className="flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        📱 View SMS
                      </button>
                    ) : d.screenshot_url ? (
                      <button
                        onClick={() => { setSelectedDeposit(d); setShowScreenshot(true); }}
                        className="flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        <Image className="h-3.5 w-3.5" /> View
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {canReview(d) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => reviewMutation.mutate(d.id)} disabled={reviewMutation.isPending}>
                          <Eye className="mr-1 h-3 w-3" /> Review
                        </Button>
                      )}
                      {canApproveReject(d) && (
                        <>
                          <Button size="sm" className="h-7 text-xs bg-status-approved hover:bg-status-approved/80 text-primary-foreground" onClick={() => { setSelectedDeposit(d); setShowApproveDialog(true); }}>
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { setSelectedDeposit(d); setShowRejectDialog(true); }}>
                            <XCircle className="mr-1 h-3 w-3" /> Reject
                          </Button>
                        </>
                      )}
                      {isLocked(d) && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" /> Locked by another admin
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No deposits found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approve Confirmation */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Confirm Deposit Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Approve <span className="font-semibold text-primary">{selectedDeposit?.amount?.toLocaleString()} ብር</span> deposit from <span className="font-semibold">{selectedDeposit?.username}</span>?</p>
            <p className="text-muted-foreground">This will credit the user's main wallet immediately.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button
              className="bg-status-approved hover:bg-status-approved/80 text-primary-foreground"
              onClick={() => selectedDeposit && approveMutation.mutate(selectedDeposit.id as any)}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Reject Deposit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Please provide a reason for rejecting this deposit.</p>
            <Textarea placeholder="Enter rejection reason..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="bg-muted border-border" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selectedDeposit && rejectMutation.mutate({ id: selectedDeposit.id as any, reason: rejectReason })}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS/Screenshot Modal */}
      <Dialog open={showScreenshot} onOpenChange={setShowScreenshot}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Proof — #{selectedDeposit?.id}</DialogTitle>
          </DialogHeader>
          {selectedDeposit?.sms_text ? (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">SMS Message:</p>
              <p className="text-sm whitespace-pre-wrap font-mono">{selectedDeposit.sms_text}</p>
            </div>
          ) : selectedDeposit?.screenshot_url ? (
            <div className="flex items-center justify-center rounded-lg bg-muted p-8">
              <img src={selectedDeposit.screenshot_url} alt="Payment screenshot" className="max-h-80 rounded" />
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg bg-muted p-8">
              <p className="text-sm text-muted-foreground">No proof available</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
