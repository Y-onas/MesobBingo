import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchGameRooms, createGameRoom, updateGameRoom, deleteGameRoom, fetchWinRules, createWinRule, updateWinRule, deleteWinRule, toggleDynamicPercentage } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  
  // Win percentage ranges for room creation
  const [winRanges, setWinRanges] = useState<Array<{min_players: string, max_players: string, win_percentage: string}>>([
    { min_players: "1", max_players: "50", win_percentage: "75" },
    { min_players: "51", max_players: "100", win_percentage: "60" }
  ]);

  // Store win rules for each room
  const [roomWinRules, setRoomWinRules] = useState<Record<number, any[]>>({});

  // Helper function to calculate dynamic win percentage
  const calculateDynamicWinPercentage = (room: any): string => {
    // If dynamic percentage is disabled, return static percentage
    if (!room.use_dynamic_percentage) {
      return `${room.winning_percentage}%`;
    }

    const currentPlayers = room.current_players || 0;
    const rules = roomWinRules[room.id] || [];

    // Find matching rule
    const matchingRule = rules.find(
      (rule: any) => currentPlayers >= rule.min_players && currentPlayers <= rule.max_players
    );

    if (matchingRule) {
      return `${matchingRule.win_percentage}%`;
    }

    // Smart fallback: adjust static percentage based on player count
    const basePercentage = room.winning_percentage;
    const midPoint = room.max_players / 2;
    
    if (currentPlayers < midPoint) {
      // Fewer players - increase win percentage
      const adjusted = Math.min(basePercentage + 5, 100);
      return `${adjusted}%`;
    } else {
      // More players - decrease win percentage
      const adjusted = Math.max(basePercentage - 5, 1);
      return `${adjusted}%`;
    }
  };



  const { data: rooms = [], isLoading, isError, error } = useQuery({
    queryKey: ["game-rooms"],
    queryFn: fetchGameRooms,
    refetchInterval: 15000,
  });

  // Fetch win rules for all rooms when rooms data changes
  const { data: allWinRules } = useQuery({
    queryKey: ["all-win-rules", rooms.map((r: any) => r.id).join(',')],
    queryFn: async () => {
      const rulesMap: Record<number, any[]> = {};
      for (const room of rooms) {
        try {
          const rules = await fetchWinRules(room.id);
          rulesMap[room.id] = rules;
        } catch (error) {
          // If error fetching rules, use empty array
          rulesMap[room.id] = [];
        }
      }
      return rulesMap;
    },
    enabled: rooms.length > 0,
  });

  // Update roomWinRules when allWinRules changes
  if (allWinRules && JSON.stringify(allWinRules) !== JSON.stringify(roomWinRules)) {
    setRoomWinRules(allWinRules);
  }



  const createMut = useMutation({
    mutationFn: async () => {
      const entry_fee = parseFloat(form.entry_fee);
      const min_players = parseInt(form.min_players);
      const max_players = parseInt(form.max_players);
      const countdown_time = parseInt(form.countdown_time);
      const winning_percentage = parseInt(form.winning_percentage);

      if (!Number.isFinite(entry_fee) || !Number.isFinite(min_players) || 
          !Number.isFinite(max_players) || !Number.isFinite(countdown_time) || 
          !Number.isFinite(winning_percentage)) {
        throw new Error("Please fill in all numeric fields with valid numbers.");
      }

      // Create the room first
      const room = await createGameRoom({
        name: form.name,
        entry_fee,
        min_players,
        max_players,
        countdown_time,
        winning_percentage,
      });

      // Create win percentage rules if any are defined with valid values
      const validRanges = winRanges.filter(r => {
        const minP = parseInt(r.min_players);
        const maxP = parseInt(r.max_players);
        const winP = parseInt(r.win_percentage);
        return Number.isFinite(minP) && Number.isFinite(maxP) && Number.isFinite(winP);
      });

      if (validRanges.length > 0) {
        // Sort ranges by min_players
        const sortedRanges = validRanges.sort((a, b) => parseInt(a.min_players) - parseInt(b.min_players));
        
        // Check if we need to add a final range
        const lastRange = sortedRanges[sortedRanges.length - 1];
        const lastMaxPlayers = parseInt(lastRange.max_players);
        
        if (lastMaxPlayers < max_players) {
          // Create a final range from (lastMax + 1) to max_players
          // with 5% less than the last range's win percentage
          const lastWinPercentage = parseInt(lastRange.win_percentage);
          const newWinPercentage = Math.max(lastWinPercentage - 5, 1); // Minimum 1%
          
          sortedRanges.push({
            min_players: String(lastMaxPlayers + 1),
            max_players: String(max_players),
            win_percentage: String(newWinPercentage),
          });
        }

        // Create all rules with skip_validation, except the last one
        for (let i = 0; i < sortedRanges.length; i++) {
          const range = sortedRanges[i];
          const isLastRule = i === sortedRanges.length - 1;
          
          await createWinRule(room.id, {
            min_players: parseInt(range.min_players),
            max_players: parseInt(range.max_players),
            win_percentage: parseInt(range.win_percentage),
            skip_validation: !isLastRule, // Only validate on the last rule
          });
        }
        
        // Enable dynamic percentage if rules were created
        await toggleDynamicPercentage(room.id, true);
      }

      return room;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-rooms"] });
      setShowCreate(false);
      setForm({ name: "", entry_fee: "", min_players: "5", max_players: "20", countdown_time: "120", winning_percentage: "75" });
      setWinRanges([
        { min_players: "1", max_players: "50", win_percentage: "75" },
        { min_players: "51", max_players: "100", win_percentage: "60" }
      ]);
      toast({ title: "Game room created ✓" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const entry_fee = parseFloat(form.entry_fee);
      const min_players = parseInt(form.min_players);
      const max_players = parseInt(form.max_players);
      const countdown_time = parseInt(form.countdown_time);
      const winning_percentage = parseInt(form.winning_percentage);

      if (!Number.isFinite(entry_fee) || !Number.isFinite(min_players) || 
          !Number.isFinite(max_players) || !Number.isFinite(countdown_time) || 
          !Number.isFinite(winning_percentage)) {
        throw new Error("Please fill in all numeric fields with valid numbers.");
      }

      // Update the room
      const room = await updateGameRoom(editingRoom.id, {
        name: form.name,
        entry_fee,
        min_players,
        max_players,
        countdown_time,
        winning_percentage,
      });

      // Fetch existing rules
      const existingRules = await fetchWinRules(editingRoom.id);
      
      // Delete all existing rules
      for (const rule of existingRules) {
        await deleteWinRule(editingRoom.id, rule.id);
      }

      // Create new win percentage rules if any are defined with valid values
      const validRanges = winRanges.filter(r => {
        const minP = parseInt(r.min_players);
        const maxP = parseInt(r.max_players);
        const winP = parseInt(r.win_percentage);
        return Number.isFinite(minP) && Number.isFinite(maxP) && Number.isFinite(winP);
      });

      if (validRanges.length > 0) {
        // Sort ranges by min_players
        const sortedRanges = validRanges.sort((a, b) => parseInt(a.min_players) - parseInt(b.min_players));
        
        // Check if we need to add a final range
        const lastRange = sortedRanges[sortedRanges.length - 1];
        const lastMaxPlayers = parseInt(lastRange.max_players);
        
        if (lastMaxPlayers < max_players) {
          // Create a final range from (lastMax + 1) to max_players
          // with 5% less than the last range's win percentage
          const lastWinPercentage = parseInt(lastRange.win_percentage);
          const newWinPercentage = Math.max(lastWinPercentage - 5, 1); // Minimum 1%
          
          sortedRanges.push({
            min_players: String(lastMaxPlayers + 1),
            max_players: String(max_players),
            win_percentage: String(newWinPercentage),
          });
        }

        // Create all rules with skip_validation, except the last one
        for (let i = 0; i < sortedRanges.length; i++) {
          const range = sortedRanges[i];
          const isLastRule = i === sortedRanges.length - 1;
          
          await createWinRule(editingRoom.id, {
            min_players: parseInt(range.min_players),
            max_players: parseInt(range.max_players),
            win_percentage: parseInt(range.win_percentage),
            skip_validation: !isLastRule, // Only validate on the last rule
          });
        }
        
        // Enable dynamic percentage if rules were created
        await toggleDynamicPercentage(editingRoom.id, true);
      } else {
        // Disable dynamic percentage if no rules
        await toggleDynamicPercentage(editingRoom.id, false);
      }

      return room;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-rooms"] });
      setEditingRoom(null);
      setForm({ name: "", entry_fee: "", min_players: "5", max_players: "20", countdown_time: "120", winning_percentage: "75" });
      setWinRanges([
        { min_players: "1", max_players: "50", win_percentage: "75" },
        { min_players: "51", max_players: "100", win_percentage: "60" }
      ]);
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



  const handleEdit = async (room: any) => {
    setEditingRoom(room);
    setForm({
      name: room.name,
      entry_fee: String(room.entry_fee),
      min_players: String(room.min_players),
      max_players: String(room.max_players),
      countdown_time: String(room.countdown_time),
      winning_percentage: String(room.winning_percentage),
    });
    
    // Load existing win rules for this room
    try {
      const existingRules = await fetchWinRules(room.id);
      if (existingRules.length > 0) {
        setWinRanges(existingRules.map((rule: any) => ({
          min_players: String(rule.min_players),
          max_players: String(rule.max_players),
          win_percentage: String(rule.win_percentage),
        })));
      } else {
        // Default ranges if no rules exist
        setWinRanges([
          { min_players: "1", max_players: "50", win_percentage: "75" },
          { min_players: "51", max_players: "100", win_percentage: "60" }
        ]);
      }
    } catch (error) {
      // If error loading rules, use defaults
      setWinRanges([
        { min_players: "1", max_players: "50", win_percentage: "75" },
        { min_players: "51", max_players: "100", win_percentage: "60" }
      ]);
    }
  };

  const addWinRange = () => {
    setWinRanges([...winRanges, { min_players: "", max_players: "", win_percentage: "" }]);
  };

  const removeWinRange = (index: number) => {
    setWinRanges(winRanges.filter((_, i) => i !== index));
  };

  const updateWinRange = (index: number, field: string, value: string) => {
    const updated = [...winRanges];
    updated[index] = { ...updated[index], [field]: value };
    setWinRanges(updated);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this room?")) {
      deleteMut.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Game Rooms</h1>
            <p className="text-sm text-muted-foreground">Manage Bingo game rooms</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Create Room</Button>
        </div>
        <div className="glass-card flex flex-col items-center gap-3 p-12">
          <Gamepad2 className="h-12 w-12 text-status-rejected" />
          <p className="text-lg font-semibold">Unable to Load Game Rooms</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again later."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["game-rooms"] })}
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
                <span>Win: {calculateDynamicWinPercentage(room)}</span>
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
                  className="gap-1"
                >
                  <Trash2 className="h-3 w-3" />
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
          setWinRanges([
            { min_players: "1", max_players: "50", win_percentage: "75" },
            { min_players: "51", max_players: "100", win_percentage: "60" }
          ]);
        }
      }}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRoom ? "Edit" : "Create New"} Bingo Room</DialogTitle></DialogHeader>
          <div className="space-y-4">
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
                <Label>Countdown (seconds)</Label>
                <Input type="number" value={form.countdown_time} onChange={(e) => setForm({ ...form, countdown_time: e.target.value })} className="bg-muted border-border" />
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

            {/* Win % by Player Count Section - Show for both create and edit */}
            <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Win % by Player Count</Label>
                  <Button 
                    type="button"
                    size="sm" 
                    variant="outline" 
                    onClick={addWinRange}
                    className="gap-1 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                  >
                    <Plus className="h-3 w-3" />
                    Add Range
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground px-1">
                    <span>Min Players</span>
                    <span>Max Players</span>
                    <span>Win %</span>
                    <span className="w-8"></span>
                  </div>
                  
                  {winRanges.map((range, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                      <Input
                        type="number"
                        placeholder="1"
                        value={range.min_players}
                        onChange={(e) => updateWinRange(index, 'min_players', e.target.value)}
                        className="bg-background border-border"
                      />
                      <Input
                        type="number"
                        placeholder="50"
                        value={range.max_players}
                        onChange={(e) => updateWinRange(index, 'max_players', e.target.value)}
                        className="bg-background border-border"
                      />
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="75"
                          value={range.win_percentage}
                          onChange={(e) => updateWinRange(index, 'win_percentage', e.target.value)}
                          className="bg-background border-border pr-8 text-amber-500 font-semibold"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeWinRange(index)}
                        disabled={winRanges.length === 1}
                        className="h-9 w-9 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  Define win percentage ranges based on player count. Ranges must cover all players from 1 to max without gaps or overlaps.
                </p>
              </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreate(false);
              setEditingRoom(null);
              setForm({ name: "", entry_fee: "", min_players: "5", max_players: "20", countdown_time: "120", winning_percentage: "75" });
              setWinRanges([
                { min_players: "1", max_players: "50", win_percentage: "75" },
                { min_players: "51", max_players: "100", win_percentage: "60" }
              ]);
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
