import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchGameRooms, createGameRoom, updateGameRoom, deleteGameRoom } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Gamepad2, Loader2, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GameRoomsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", entry_fee: "", min_players: "5", max_players: "20", countdown_time: "120", winning_percentage: "75",
  });

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ["game-rooms"],
    queryFn: fetchGameRooms,
    refetchInterval: 15000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createGameRoom({
        name: form.name,
        entry_fee: parseFloat(form.entry_fee),
        min_players: parseInt(form.min_players),
        max_players: parseInt(form.max_players),
        countdown_time: parseInt(form.countdown_time),
        winning_percentage: parseInt(form.winning_percentage),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-rooms"] });
      setShowCreate(false);
      setForm({ name: "", entry_fee: "", min_players: "5", max_players: "20", countdown_time: "120", winning_percentage: "75" });
      toast({ title: "Game room created ✓" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      updateGameRoom(editingRoom.id, {
        name: form.name,
        entry_fee: parseFloat(form.entry_fee),
        min_players: parseInt(form.min_players),
        max_players: parseInt(form.max_players),
        countdown_time: parseInt(form.countdown_time),
        winning_percentage: parseInt(form.winning_percentage),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-rooms"] });
      setEditingRoom(null);
      setForm({ name: "", entry_fee: "", min_players: "5", max_players: "20", countdown_time: "120", winning_percentage: "75" });
      toast({ title: "Game room updated ✓" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteGameRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-rooms"] });
      toast({ title: "Game room deleted ✓" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleEdit = (room: any) => {
    setEditingRoom(room);
    setForm({
      name: room.name,
      entry_fee: String(room.entry_fee),
      min_players: String(room.min_players),
      max_players: String(room.max_players),
      countdown_time: String(room.countdown_time),
      winning_percentage: String(room.winning_percentage),
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this room?")) {
      deleteMut.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Game Rooms</h1>
          <p className="text-sm text-muted-foreground">Manage Bingo game rooms</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Create Room</Button>
      </div>

      {rooms.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 p-12">
          <Gamepad2 className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-semibold">No Rooms Yet</p>
          <p className="text-sm text-muted-foreground">Create your first Bingo room to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room: any) => (
            <div key={room.id} className="glass-card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{room.name}</h3>
                <StatusBadge status={room.status === "waiting" ? "pending" : room.status === "active" ? "under_review" : "approved"} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Entry Fee</p>
                  <p className="font-mono font-semibold">{Number(room.entry_fee).toLocaleString()} ብር</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Players</p>
                  <p className="font-mono">{room.current_players}/{room.max_players}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Pot</p>
                  <p className="font-mono">{Number(room.total_pot).toLocaleString()} ብር</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payout</p>
                  <p className="font-mono">{Number(room.expected_payout).toLocaleString()} ብር</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Countdown: {room.countdown_time}s</span>
                <span>Win: {room.winning_percentage}%</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleEdit(room)}
                  className="flex-1 gap-1"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => handleDelete(room.id)}
                  disabled={deleteMut.isPending}
                  className="flex-1 gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Room Dialog */}
      <Dialog open={showCreate || !!editingRoom} onOpenChange={(open) => {
        if (!open) {
          setShowCreate(false);
          setEditingRoom(null);
          setForm({ name: "", entry_fee: "", min_players: "5", max_players: "20", countdown_time: "120", winning_percentage: "75" });
        }
      }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{editingRoom ? "Edit" : "Create New"} Bingo Room</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Room Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bronze Room" className="bg-muted border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Entry Fee (ብር)</Label>
                <Input type="number" value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: e.target.value })} placeholder="50" className="bg-muted border-border" />
              </div>
              <div>
                <Label>Win %</Label>
                <Input type="number" value={form.winning_percentage} onChange={(e) => setForm({ ...form, winning_percentage: e.target.value })} className="bg-muted border-border" />
              </div>
              <div>
                <Label>Min Players</Label>
                <Input type="number" value={form.min_players} onChange={(e) => setForm({ ...form, min_players: e.target.value })} className="bg-muted border-border" />
              </div>
              <div>
                <Label>Max Players</Label>
                <Input type="number" value={form.max_players} onChange={(e) => setForm({ ...form, max_players: e.target.value })} className="bg-muted border-border" />
              </div>
            </div>
            <div>
              <Label>Countdown (seconds)</Label>
              <Input type="number" value={form.countdown_time} onChange={(e) => setForm({ ...form, countdown_time: e.target.value })} className="bg-muted border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreate(false);
              setEditingRoom(null);
              setForm({ name: "", entry_fee: "", min_players: "5", max_players: "20", countdown_time: "120", winning_percentage: "75" });
            }}>Cancel</Button>
            <Button 
              onClick={() => editingRoom ? updateMut.mutate() : createMut.mutate()} 
              disabled={!form.name || !form.entry_fee || createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingRoom ? "Update" : "Create"} Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
