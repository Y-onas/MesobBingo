import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchConfigs, updateConfig, rollbackConfig, fetchConfigHistory,
  fetchReferralTiers, upsertReferralTier, deleteReferralTier,
  fetchPaymentAccounts, upsertPaymentAccount, deletePaymentAccount,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Shield, CreditCard, Gamepad2, TrendingUp, Gift,
  ToggleLeft, ToggleRight, History, RotateCcw, Plus, Trash2,
  Edit2, Edit, Check, X, AlertTriangle, MessageSquare, Info, Eye,
  ChevronDown, ChevronRight, Save,
} from "lucide-react";

// ─── Category Styles ────────────────────────────────────────────────
const categoryMeta: Record<string, { icon: any; color: string; label: string }> = {
  payment: { icon: CreditCard, color: "text-blue-500", label: "Payment" },
  game: { icon: Gamepad2, color: "text-purple-500", label: "Game" },
  limits: { icon: Shield, color: "text-orange-500", label: "Limits" },
  bonuses: { icon: Gift, color: "text-green-500", label: "Bonuses" },
  features: { icon: ToggleLeft, color: "text-red-500", label: "Kill Switches" },
  messages: { icon: MessageSquare, color: "text-cyan-500", label: "Bot Messages" },
};

// ─── Placeholder Docs ───────────────────────────────────────────────
// Tells admins what each {token} will be replaced with at runtime
const PLACEHOLDER_DOCS: Record<string, { token: string; meaning: string }[]> = {
  msg_welcome: [],
  msg_balance: [
    { token: "{mainWallet}", meaning: "Main wallet balance (e.g. 150.00)" },
    { token: "{playWallet}", meaning: "Play wallet balance (e.g. 50.00)" },
    { token: "{total}", meaning: "Total balance (main + play)" },
  ],
  msg_deposit_instructions: [],
  msg_deposit_telebirr: [
    { token: "{telebirrNumber}", meaning: "Active Telebirr account number" },
    { token: "{minDeposit}", meaning: "Minimum deposit amount from config" },
  ],
  msg_deposit_cbe: [
    { token: "{cbeAccount}", meaning: "Active CBE account number" },
    { token: "{minDeposit}", meaning: "Minimum deposit amount from config" },
  ],
  msg_withdraw_prompt: [
    { token: "{minWithdraw}", meaning: "Minimum withdrawal amount from config" },
  ],
  msg_withdraw_success: [
    { token: "{amount}", meaning: "Withdrawal amount entered by user" },
  ],
  msg_deposit_submitted: [
    { token: "{amount}", meaning: "Deposit amount" },
    { token: "{method}", meaning: "Payment method (TELEBIRR / CBE)" },
  ],
  msg_contact_us: [
    { token: "{supportUsername}", meaning: "Support Telegram username" },
  ],
  msg_join_channel: [
    { token: "{channelUrl}", meaning: "Official Telegram channel URL" },
  ],
  msg_insufficient_balance: [],
  msg_admin_only: [],
  msg_deposit_cancelled: [],
  msg_withdraw_cancelled: [],
  msg_phone_verify: [],
};

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"config" | "tiers" | "accounts">("config");
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // ─── Queries ────────────────────────────────────────────────────────
  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ["configs"], queryFn: fetchConfigs,
  });
  const { data: history = [] } = useQuery({
    queryKey: ["configHistory", historyKey], queryFn: () => fetchConfigHistory(historyKey!),
    enabled: !!historyKey,
  });
  const { data: tiers = [], isLoading: tiersLoading } = useQuery({
    queryKey: ["referralTiers"], queryFn: fetchReferralTiers,
  });
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ["paymentAccounts"], queryFn: fetchPaymentAccounts,
  });

  // ─── Config Actions ────────────────────────────────────────────────
  const handleSave = async (key: string) => {
    // Validate placeholders before saving
    const placeholders = PLACEHOLDER_DOCS[key];
    if (placeholders) {
      for (const p of placeholders) {
        if (!editValue.includes(p.token)) {
          toast({
            title: "Validation Error",
            description: `Message is missing required placeholder: ${p.token}`,
            variant: "destructive"
          });
          return;
        }
      }
    }

    try {
      await updateConfig(key, editValue);
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      queryClient.invalidateQueries({ queryKey: ["configHistory", key] });
      setEditingKey(null);
      toast({ title: "✅ Updated", description: `${key} saved successfully` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRollback = async (key: string) => {
    if (!confirm(`Rollback ${key} to previous value?`)) return;
    try {
      await rollbackConfig(key);
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      queryClient.invalidateQueries({ queryKey: ["configHistory", key] });
      toast({ title: "Rolled back", description: key });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleToggle = async (key: string, current: string) => {
    const newVal = current === "true" ? "false" : "true";
    try {
      await updateConfig(key, newVal);
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      toast({ title: `${key} ${newVal === "true" ? "enabled" : "disabled"}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // ─── Referral Tier Actions ─────────────────────────────────────────
  const [tierForm, setTierForm] = useState({ minDeposit: "", maxDeposit: "", bonusAmount: "" });

  const handleAddTier = async () => {
    const min = Number(tierForm.minDeposit);
    const max = tierForm.maxDeposit ? Number(tierForm.maxDeposit) : null;
    const bonus = Number(tierForm.bonusAmount);
    
    // Validate inputs
    if (
      !Number.isFinite(min) || min <= 0 ||
      !Number.isFinite(bonus) || bonus <= 0 ||
      (max !== null && (!Number.isFinite(max) || max < min))
    ) {
      toast({
        title: "Validation Error",
        description: "Please enter valid tier amounts (max ≥ min, all > 0).",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await upsertReferralTier({
        minDeposit: min,
        maxDeposit: max,
        bonusAmount: bonus,
      });
      queryClient.invalidateQueries({ queryKey: ["referralTiers"] });
      setTierForm({ minDeposit: "", maxDeposit: "", bonusAmount: "" });
      toast({ title: "Tier added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteTier = async (id: number) => {
    if (!confirm("Delete this tier?")) return;
    try {
      await deleteReferralTier(id);
      queryClient.invalidateQueries({ queryKey: ["referralTiers"] });
      toast({ title: "Tier deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ─── Payment Account Actions ───────────────────────────────────────
  const [accForm, setAccForm] = useState({ 
    id: undefined as number | undefined, 
    provider: "telebirr", 
    accountNumber: "", 
    accountName: "",
    isActive: true,
    priority: 1
  });
  const [isEditingAccount, setIsEditingAccount] = useState(false);

  const handleAddOrUpdateAccount = async () => {
    // Add validation
    if (!accForm.accountNumber || !accForm.accountName) {
      toast({ 
        title: "Validation Error", 
        description: "Both account number and account name are required",
        variant: "destructive" 
      });
      return;
    }
    
    // Check for duplicate priority within same provider
    const duplicatePriority = accounts.find((acc: any) => 
      acc.provider === accForm.provider && 
      acc.priority === accForm.priority && 
      acc.id !== accForm.id // Exclude current account when editing
    );
    
    if (duplicatePriority) {
      toast({ 
        title: "Validation Error", 
        description: `Another ${accForm.provider} account already has priority ${accForm.priority}. Each account must have a unique priority.`,
        variant: "destructive" 
      });
      return;
    }
    
    try {
      await upsertPaymentAccount({
        id: accForm.id,
        provider: accForm.provider,
        accountNumber: accForm.accountNumber,
        accountName: accForm.accountName,
        isActive: accForm.isActive,
        priority: accForm.priority,
      });
      queryClient.invalidateQueries({ queryKey: ["paymentAccounts"] });
      setAccForm({ id: undefined, provider: "telebirr", accountNumber: "", accountName: "", isActive: true, priority: 1 });
      setIsEditingAccount(false);
      toast({ title: isEditingAccount ? "Account updated" : "Account added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleEditAccount = (acc: any) => {
    setAccForm({
      id: acc.id,
      provider: acc.provider,
      accountNumber: acc.accountNumber,
      accountName: acc.accountName || "",
      isActive: acc.isActive ?? true,
      priority: acc.priority ?? 1,
    });
    setIsEditingAccount(true);
  };

  const handleCancelEditAccount = () => {
    setAccForm({ id: undefined, provider: "telebirr", accountNumber: "", accountName: "", isActive: true, priority: 1 });
    setIsEditingAccount(false);
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm("Delete this account?")) return;
    try {
      await deletePaymentAccount(id);
      queryClient.invalidateQueries({ queryKey: ["paymentAccounts"] });
      toast({ title: "Account deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ─── Group configs by category ─────────────────────────────────────
  const grouped = configs.reduce((acc: Record<string, any[]>, c: any) => {
    const cat = c.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  // Separate messages from other configs
  const messageConfigs = grouped["messages"] || [];
  const otherGroups = Object.entries(grouped).filter(([cat]) => cat !== "messages");

  // ─── Render a simple config row (number, json, etc.) ───────────────
  const renderSimpleConfigRow = (config: any) => (
    <div key={config.configKey} className="flex items-center gap-4 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{config.configKey}</p>
        <p className="text-xs text-muted-foreground truncate">{config.description}</p>
      </div>

      {/* Kill switch toggle */}
      {config.valueType === "boolean" ? (
        <button
          onClick={() => handleToggle(config.configKey, config.configValue)}
          className="flex items-center gap-1"
        >
          {config.configValue === "true" ? (
            <ToggleRight className="h-6 w-6 text-green-500" />
          ) : (
            <ToggleLeft className="h-6 w-6 text-red-500" />
          )}
          <span className={`text-xs font-medium ${config.configValue === "true" ? "text-green-500" : "text-red-500"}`}>
            {config.configValue === "true" ? "ON" : "OFF"}
          </span>
        </button>
      ) : editingKey === config.configKey ? (
        <div className="flex items-center gap-2">
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-40 px-2 py-1 text-sm border border-border rounded bg-background"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSave(config.configKey)}
          />
          <button onClick={() => handleSave(config.configKey)} className="text-green-500 hover:text-green-400">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={() => setEditingKey(null)} className="text-red-500 hover:text-red-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">{config.configValue}</code>
          <button
            onClick={() => { setEditingKey(config.configKey); setEditValue(config.configValue); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* History / Rollback */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setHistoryKey(historyKey === config.configKey ? null : config.configKey)}
          className="text-muted-foreground hover:text-foreground p-1" title="History"
        >
          <History className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => handleRollback(config.configKey)}
          className="text-muted-foreground hover:text-foreground p-1" title="Rollback"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" /> System Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage configurations, bot messages, referral tiers, and payment accounts
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {[
          { key: "config", label: "Configuration", icon: Settings },
          { key: "tiers", label: "Referral Tiers", icon: TrendingUp },
          { key: "accounts", label: "Payment Accounts", icon: CreditCard },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === key
                ? "bg-primary/10 text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ─── Config Tab ──────────────────────────────────────────────── */}
      {activeTab === "config" && (
        <div className="space-y-6">
          {configsLoading ? (
            <p className="text-muted-foreground">Loading configs...</p>
          ) : (
            <>
              {/* Non-message categories */}
              {otherGroups.map(([category, items]) => {
                const meta = categoryMeta[category] || { icon: Settings, color: "text-gray-500", label: category };
                const Icon = meta.icon;
                const isExpanded = expandedCategories[category] !== false; // default open
                return (
                  <div key={category} className="rounded-xl border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border hover:bg-muted/70 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                      <h3 className="text-sm font-semibold">{meta.label}</h3>
                      <span className="text-xs text-muted-foreground ml-auto">{(items as any[]).length} items</span>
                    </button>
                    {isExpanded && (
                      <>
                        <div className="divide-y divide-border">
                          {(items as any[]).map(renderSimpleConfigRow)}
                        </div>
                        {/* History panel */}
                        {historyKey && (items as any[]).some((c: any) => c.configKey === historyKey) && history.length > 0 && (
                          <div className="border-t border-border bg-muted/30 p-4">
                            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                              <History className="h-3 w-3" /> History for {historyKey}
                            </h4>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {history.map((h: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs text-muted-foreground">
                                  <code className="bg-muted px-1 rounded truncate max-w-[250px]">{h.configValue}</code>
                                  <span>{new Date(h.changedAt).toLocaleDateString()} by admin {h.changedBy}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* ─── Bot Messages Section ─────────────────────────────────── */}
              {messageConfigs.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 bg-muted/50 border-b border-border">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-cyan-500" />
                      <h3 className="text-sm font-semibold">Bot Messages</h3>
                      <span className="text-xs text-muted-foreground ml-auto">{messageConfigs.length} messages</span>
                    </div>
                    <div className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                      <Info className="h-3.5 w-3.5 text-cyan-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-cyan-400">
                        <strong>Placeholders</strong> like <code className="bg-muted px-1 rounded text-cyan-300">{"{telebirrNumber}"}</code> are
                        auto-replaced with real values when the bot sends the message.
                        Keep them as-is — only change the text around them.
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {messageConfigs.map((config: any) => {
                      const isEditing = editingKey === config.configKey;
                      const isPreviewing = previewMsg === config.configKey;
                      const placeholders = PLACEHOLDER_DOCS[config.configKey] || [];
                      const displayName = config.configKey.replace(/^msg_/, "").replace(/_/g, " ");

                      return (
                        <div key={config.configKey} className="px-4 py-3">
                          {/* Header row */}
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <p className="text-sm font-medium capitalize">{displayName}</p>
                              <p className="text-xs text-muted-foreground">{config.description}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setPreviewMsg(isPreviewing ? null : config.configKey)}
                                className={`p-1.5 rounded text-xs flex items-center gap-1 ${isPreviewing ? "bg-cyan-500/10 text-cyan-500" : "text-muted-foreground hover:text-foreground"}`}
                                title="Preview"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              {!isEditing && (
                                <button
                                  onClick={() => { setEditingKey(config.configKey); setEditValue(config.configValue); }}
                                  className="p-1.5 rounded text-muted-foreground hover:text-foreground"
                                  title="Edit"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setHistoryKey(historyKey === config.configKey ? null : config.configKey)}
                                className="p-1.5 rounded text-muted-foreground hover:text-foreground"
                                title="History"
                              >
                                <History className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleRollback(config.configKey)}
                                className="p-1.5 rounded text-muted-foreground hover:text-foreground"
                                title="Rollback to previous"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Preview mode */}
                          {isPreviewing && !isEditing && (
                            <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border">
                              <p className="text-xs text-muted-foreground mb-1 font-medium">Preview (as bot sends it):</p>
                              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{config.configValue}</pre>
                            </div>
                          )}

                          {/* Edit mode — full textarea */}
                          {isEditing && (
                            <div className="mt-2 space-y-3">
                              {/* Placeholder docs */}
                              {placeholders.length > 0 && (
                                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                  <p className="text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Available Placeholders — do not remove these:
                                  </p>
                                  <div className="space-y-1">
                                    {placeholders.map((p) => (
                                      <div key={p.token} className="flex items-center gap-2 text-xs">
                                        <code className="bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded font-mono shrink-0">{p.token}</code>
                                        <span className="text-muted-foreground">→ {p.meaning}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Textarea */}
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background font-mono leading-relaxed resize-y min-h-[120px]"
                                rows={Math.max(4, editValue.split("\n").length + 1)}
                                autoFocus
                              />

                              {/* Live preview */}
                              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                                <p className="text-xs text-muted-foreground mb-1 font-medium">Live Preview:</p>
                                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{editValue}</pre>
                              </div>

                              {/* Save / Cancel buttons */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSave(config.configKey)}
                                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
                                >
                                  <Save className="h-3.5 w-3.5" /> Save Message
                                </button>
                                <button
                                  onClick={() => setEditingKey(null)}
                                  className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted text-muted-foreground"
                                >
                                  <X className="h-3.5 w-3.5" /> Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* History inline */}
                          {historyKey === config.configKey && history.length > 0 && (
                            <div className="mt-2 p-3 rounded-lg bg-muted/30 border border-border">
                              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                                <History className="h-3 w-3" /> Change History
                              </h4>
                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {history.map((h: any, i: number) => (
                                  <div key={i} className="text-xs">
                                    <div className="flex justify-between text-muted-foreground mb-0.5">
                                      <span>{new Date(h.changedAt).toLocaleString()}</span>
                                      <span>by admin {h.changedBy}</span>
                                    </div>
                                    <pre className="bg-muted p-1.5 rounded text-xs whitespace-pre-wrap max-h-16 overflow-y-auto">{h.configValue}</pre>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Referral Tiers Tab ──────────────────────────────────────── */}
      {activeTab === "tiers" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" /> Referral Bonus Tiers
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Add form */}
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-muted-foreground">Min Deposit</label>
                <input
                  type="number" value={tierForm.minDeposit}
                  onChange={(e) => setTierForm({ ...tierForm, minDeposit: e.target.value })}
                  className="w-24 px-2 py-1 text-sm border border-border rounded bg-background block mt-1"
                  placeholder="50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max Deposit</label>
                <input
                  type="number" value={tierForm.maxDeposit}
                  onChange={(e) => setTierForm({ ...tierForm, maxDeposit: e.target.value })}
                  className="w-24 px-2 py-1 text-sm border border-border rounded bg-background block mt-1"
                  placeholder="∞"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Bonus Amount</label>
                <input
                  type="number" value={tierForm.bonusAmount}
                  onChange={(e) => setTierForm({ ...tierForm, bonusAmount: e.target.value })}
                  className="w-24 px-2 py-1 text-sm border border-border rounded bg-background block mt-1"
                  placeholder="5"
                />
              </div>
              <button
                onClick={handleAddTier}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>

            {/* Table */}
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Min Deposit</th>
                  <th className="text-left py-2">Max Deposit</th>
                  <th className="text-left py-2">Bonus</th>
                  <th className="text-left py-2">Active</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tiersLoading ? (
                  <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Loading...</td></tr>
                ) : tiers.map((tier: any) => (
                  <tr key={tier.id} className="border-b border-border">
                    <td className="py-2">{Number(tier.minDeposit).toFixed(2)} Birr</td>
                    <td className="py-2">{tier.maxDeposit ? `${Number(tier.maxDeposit).toFixed(2)} Birr` : "∞"}</td>
                    <td className="py-2 font-medium text-green-500">{Number(tier.bonusAmount).toFixed(2)} Birr</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${tier.isActive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                        {tier.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => handleDeleteTier(tier.id)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Payment Accounts Tab ────────────────────────────────────── */}
      {activeTab === "accounts" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" /> Payment Accounts
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              The system uses the <strong>active</strong> account with the <strong>highest priority</strong> for each provider. Set priority to control which account is used.
            </p>
          </div>
          <div className="p-4 space-y-4">
            {/* Add/Edit form */}
            <div className="space-y-3">
              {isEditingAccount && (
                <div className="text-sm text-blue-600 font-medium">
                  Editing Account #{accForm.id}
                </div>
              )}
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="text-xs text-muted-foreground">Provider</label>
                  <select
                    value={accForm.provider}
                    onChange={(e) => setAccForm({ ...accForm, provider: e.target.value })}
                    className="px-2 py-1 text-sm border border-border rounded bg-background block mt-1"
                    disabled={isEditingAccount}
                  >
                    <option value="telebirr">Telebirr</option>
                    <option value="cbe">CBE</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Account Number</label>
                  <input
                    value={accForm.accountNumber}
                    onChange={(e) => setAccForm({ ...accForm, accountNumber: e.target.value })}
                    className="w-40 px-2 py-1 text-sm border border-border rounded bg-background block mt-1"
                    placeholder="0900000000"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Account Name</label>
                  <input
                    value={accForm.accountName}
                    onChange={(e) => setAccForm({ ...accForm, accountName: e.target.value })}
                    className="w-40 px-2 py-1 text-sm border border-border rounded bg-background block mt-1"
                    placeholder="Company Name"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Priority (Higher = Preferred)</label>
                  <input
                    type="number"
                    value={accForm.priority}
                    onChange={(e) => setAccForm({ ...accForm, priority: parseInt(e.target.value) || 0 })}
                    className="w-24 px-2 py-1 text-sm border border-border rounded bg-background block mt-1"
                    placeholder="1"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select
                    value={accForm.isActive ? "active" : "inactive"}
                    onChange={(e) => setAccForm({ ...accForm, isActive: e.target.value === "active" })}
                    className="px-2 py-1 text-sm border border-border rounded bg-background block mt-1"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddOrUpdateAccount}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    {isEditingAccount ? (
                      <>
                        <Save className="h-3 w-3" /> Update
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3" /> Add
                      </>
                    )}
                  </button>
                  {isEditingAccount && (
                    <button
                      onClick={handleCancelEditAccount}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded hover:bg-muted/80"
                    >
                      <X className="h-3 w-3" /> Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Provider</th>
                  <th className="text-left py-2">Account Number</th>
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Active</th>
                  <th className="text-left py-2">Priority</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accountsLoading ? (
                  <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Loading...</td></tr>
                ) : accounts.map((acc: any) => (
                  <tr key={acc.id} className="border-b border-border">
                    <td className="py-2 font-medium uppercase">{acc.provider}</td>
                    <td className="py-2 font-mono">{acc.accountNumber}</td>
                    <td className="py-2 text-muted-foreground">{acc.accountName || "—"}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${acc.isActive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                        {acc.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-2">{acc.priority}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEditAccount(acc)} 
                          className="text-blue-500 hover:text-blue-400"
                          title="Edit account"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteAccount(acc.id)} 
                          className="text-red-500 hover:text-red-400"
                          title="Delete account"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
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
