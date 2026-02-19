import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithdrawals, reviewWithdrawal, approveWithdrawal, rejectWithdrawal } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import type { Withdrawal } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Eye, Lock, CheckCircle2, XCircle, AlertTriangle, Wallet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ADMIN_ID = () => localStorage.getItem("mesob_admin_id") || "admin-001";

export default function WithdrawalsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [filter, setFilter] = useState<Withdrawal["status"] | "all">("all");

  const { data: withdrawals = [], isLoading } = useQuery({
    queryKey: ["withdrawals"],
    queryFn: () => fetchWithdrawals(),
    refetchInterval: 10000,
  });

  const filtered = filter === "all" ? withdrawals : withdrawals.filter((w: any) => w.status === filter);

  const reviewMut = useMutation({
    mutationFn: (id: number) => reviewWithdrawal(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["withdrawals"] }); toast({ title: "Withdrawal locked for review" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => approveWithdrawal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setShowApproveDialog(false);
      setSelected(null);
      toast({ title: "Withdrawal approved ✓" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectWithdrawal(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      setShowRejectDialog(false);
      setRejectReason("");
      setSelected(null);
      toast({ title: "Withdrawal rejected & refunded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canReview = (w: any) => w.status === "pending";
  const canApproveReject = (w: any) => w.status === "under_review" && w.assigned_admin === ADMIN_ID();
  const isLocked = (w: any) => w.status === "under_review" && w.assigned_admin !== ADMIN_ID();
  const insufficientBalance = (w: any) => w.user_wallet < w.amount;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Withdrawal Management</h1>
        <p className="text-sm text-muted-foreground">Review and approve withdrawal requests</p>
      </div>

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
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w: any) => (
                <tr key={w.id} className={cn("border-b border-border/50 transition-colors hover:bg-muted/20", isLocked(w) && "opacity-60")}>
                  <td className="px-4 py-3 font-mono text-xs">{w.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{w.username}</p>
                    <p className="text-xs text-muted-foreground">{w.telegram_id}</p>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold">{Number(w.amount).toLocaleString()} ብር</td>
                  <td className="px-4 py-3 text-xs">{w.payment_method}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Wallet className="h-3 w-3 text-muted-foreground" />
                      <span className={cn("font-mono text-xs", insufficientBalance(w) ? "text-status-rejected" : "text-status-approved")}>
                        {Number(w.user_wallet).toLocaleString()} ብር
                      </span>
                      {insufficientBalance(w) && <AlertTriangle className="h-3 w-3 text-status-rejected" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(w.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {canReview(w) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => reviewMut.mutate(w.id)} disabled={reviewMut.isPending}>
                          <Eye className="mr-1 h-3 w-3" /> Review
                        </Button>
                      )}
                      {canApproveReject(w) && (
                        <>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-status-approved hover:bg-status-approved/80 text-primary-foreground"
                            onClick={() => { setSelected(w); setShowApproveDialog(true); }}
                            disabled={insufficientBalance(w)}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { setSelected(w); setShowRejectDialog(true); }}>
                            <XCircle className="mr-1 h-3 w-3" /> Reject
                          </Button>
                        </>
                      )}
                      {isLocked(w) && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No withdrawals found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approve Dialog with Safety Info */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Confirm Withdrawal Approval</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-4 text-sm">
                <div><span className="text-muted-foreground">Wallet Balance:</span> <span className="font-mono font-semibold">{Number(selected.user_wallet).toLocaleString()} ብር</span></div>
                <div><span className="text-muted-foreground">Withdraw Amount:</span> <span className="font-mono font-semibold text-status-rejected">{Number(selected.amount).toLocaleString()} ብር</span></div>
                <div><span className="text-muted-foreground">Total Deposited:</span> <span className="font-mono">{Number(selected.user_total_deposited).toLocaleString()} ብር</span></div>
                <div><span className="text-muted-foreground">Total Withdrawn:</span> <span className="font-mono">{Number(selected.user_total_withdrawn).toLocaleString()} ብር</span></div>
                <div><span className="text-muted-foreground">Games Played:</span> <span className="font-mono">{selected.user_games_played}</span></div>
                <div><span className="text-muted-foreground">Games Won:</span> <span className="font-mono">{selected.user_games_won}</span></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button
              className="bg-status-approved hover:bg-status-approved/80 text-primary-foreground"
              onClick={() => selected && approveMut.mutate(selected.id as any)}
              disabled={approveMut.isPending}
            >
              {approveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Reject Withdrawal</DialogTitle></DialogHeader>
          <Textarea placeholder="Enter rejection reason..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="bg-muted border-border" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selected && rejectMut.mutate({ id: selected.id as any, reason: rejectReason })}
              disabled={!rejectReason.trim() || rejectMut.isPending}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
