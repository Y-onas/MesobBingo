import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchUsers, toggleBanUser, adjustWallet, resetBonus, verifyPhone, fetchUser } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Ban, Wallet, ShieldCheck, Phone, Loader2, UserCheck, Gift, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["users", search],
    queryFn: () => fetchUsers(search || undefined),
    refetchInterval: 30000,
  });

  const banMut = useMutation({
    mutationFn: (id: string) => toggleBanUser(id),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: data.is_banned ? "User banned" : "User unbanned" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const adjustMut = useMutation({
    mutationFn: ({ id, amount, reason }: { id: string; amount: number; reason: string }) =>
      adjustWallet(id, amount, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowAdjust(false);
      setAdjustAmount("");
      setAdjustReason("");
      toast({ title: `Wallet adjusted → ${data.new_balance.toLocaleString()} ብር` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetBonusMut = useMutation({
    mutationFn: (id: string) => resetBonus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Bonus eligibility reset" });
    },
  });

  const verifyPhoneMut = useMutation({
    mutationFn: (id: string) => verifyPhone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Phone marked as verified" });
    },
  });

  const openProfile = async (user: any) => {
    setSelectedUser(user);
    setShowProfile(true);
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">Search, view profiles, and manage users</p>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by Telegram ID, username or phone..."
            className="pl-10 bg-muted border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refetch()}
          />
        </div>
        <Button onClick={() => refetch()} variant="outline">Search</Button>
      </div>

      {/* Users Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Deposited</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Games</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.telegram_id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <button onClick={() => openProfile(u)} className="text-left hover:text-primary transition-colors">
                      <p className="font-medium">{u.username}</p>
                      <p className="text-xs text-muted-foreground">ID: {u.telegram_id}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{Number(u.main_wallet).toLocaleString()} ብር</td>
                  <td className="px-4 py-3 font-mono text-sm">{Number(u.total_deposited).toLocaleString()} ብር</td>
                  <td className="px-4 py-3 font-mono text-xs">{u.games_played} / {u.games_won}W</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.is_banned && <span className="inline-flex items-center gap-1 rounded bg-status-rejected/10 px-2 py-0.5 text-xs font-semibold text-status-rejected"><Ban className="h-3 w-3" /> Banned</span>}
                      {u.phone_verified && <span className="inline-flex items-center gap-1 rounded bg-status-approved/10 px-2 py-0.5 text-xs font-semibold text-status-approved"><ShieldCheck className="h-3 w-3" /> Verified</span>}
                      {!u.is_banned && !u.phone_verified && <span className="text-xs text-muted-foreground">Active</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openProfile(u)}>
                        Profile
                      </Button>
                      <Button
                        size="sm"
                        variant={u.is_banned ? "outline" : "destructive"}
                        className="h-7 text-xs"
                        onClick={() => banMut.mutate(u.telegram_id)}
                        disabled={banMut.isPending}
                      >
                        <Ban className="mr-1 h-3 w-3" /> {u.is_banned ? "Unban" : "Ban"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profile Dialog */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              {selectedUser?.username}
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Telegram ID</p>
                  <p className="font-mono font-semibold">{selectedUser.telegram_id}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-mono">{selectedUser.phone || "—"}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Main Wallet</p>
                  <p className="font-mono font-semibold text-primary">{Number(selectedUser.main_wallet).toLocaleString()} ብር</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Bonus Wallet</p>
                  <p className="font-mono">{Number(selectedUser.bonus_wallet).toLocaleString()} ብር</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Total Deposited</p>
                  <p className="font-mono">{Number(selectedUser.total_deposited).toLocaleString()} ብር</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Total Withdrawn</p>
                  <p className="font-mono">{Number(selectedUser.total_withdrawn).toLocaleString()} ብር</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Games Played</p>
                  <p className="font-mono">{selectedUser.games_played}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Games Won</p>
                  <p className="font-mono">{selectedUser.games_won}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Referrals</p>
                  <p className="font-mono">{selectedUser.referral_count}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="font-mono text-xs">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setShowProfile(false); setShowAdjust(true); }}>
                  <Wallet className="mr-1 h-3 w-3" /> Adjust Wallet
                </Button>
                <Button size="sm" variant="outline" onClick={() => resetBonusMut.mutate(selectedUser.telegram_id)}>
                  <RotateCcw className="mr-1 h-3 w-3" /> Reset Bonus
                </Button>
                {!selectedUser.phone_verified && (
                  <Button size="sm" variant="outline" onClick={() => verifyPhoneMut.mutate(selectedUser.telegram_id)}>
                    <Phone className="mr-1 h-3 w-3" /> Verify Phone
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={selectedUser.is_banned ? "outline" : "destructive"}
                  onClick={() => { banMut.mutate(selectedUser.telegram_id); setShowProfile(false); }}
                >
                  <Ban className="mr-1 h-3 w-3" /> {selectedUser.is_banned ? "Unban" : "Ban"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wallet Adjust Dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Adjust Wallet — {selectedUser?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Current balance: <span className="font-mono font-semibold">{Number(selectedUser?.main_wallet || 0).toLocaleString()} ብር</span></p>
            <Input
              type="number"
              placeholder="Amount (positive to add, negative to deduct)"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              className="bg-muted border-border"
            />
            <Textarea
              placeholder="Reason for adjustment..."
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="bg-muted border-border"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjust(false)}>Cancel</Button>
            <Button
              onClick={() => selectedUser && adjustMut.mutate({ id: selectedUser.telegram_id, amount: parseFloat(adjustAmount), reason: adjustReason })}
              disabled={!adjustAmount || !adjustReason.trim() || adjustMut.isPending}
            >
              {adjustMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
