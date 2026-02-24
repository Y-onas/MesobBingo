import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdmins, addAdmin, deactivateAdmin, activateAdmin, updateAdminRole } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserPlus, Users, CheckCircle2, XCircle, Crown, Wallet, Headphones, UserCog } from "lucide-react";
import type { Admin, AdminRole } from "@/types/dashboard";

const ROLES = [
  { value: "super_admin", label: "Super Admin", icon: Crown, color: "text-yellow-500 bg-yellow-500/10" },
  { value: "admin", label: "Admin", icon: UserCog, color: "text-purple-500 bg-purple-500/10" },
  { value: "finance_admin", label: "Finance Admin", icon: Wallet, color: "text-blue-500 bg-blue-500/10" },
  { value: "support_admin", label: "Support Admin", icon: Headphones, color: "text-green-500 bg-green-500/10" },
];

const getRoleBadge = (role: string) => {
  const r = ROLES.find((r) => r.value === role);
  if (!r) return <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{role}</span>;
  const Icon = r.icon;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${r.color}`}>
      <Icon className="h-3 w-3" /> {r.label}
    </span>
  );
};

export default function AdminManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ telegramId: "", name: "", email: "", role: "support_admin" });
  const [editingRole, setEditingRole] = useState<number | null>(null);
  const [newRole, setNewRole] = useState("");

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: fetchAdmins,
  });

  const handleAdd = async () => {
    if (!form.telegramId || !form.name) {
      toast({ title: "Error", description: "Telegram ID and Name are required", variant: "destructive" });
      return;
    }
    if (!/^\d+$/.test(form.telegramId)) {
      toast({ title: "Error", description: "Telegram ID must be numeric", variant: "destructive" });
      return;
    }
    try {
      await addAdmin(form);
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setForm({ telegramId: "", name: "", email: "", role: "support_admin" });
      setShowForm(false);
      toast({ title: "Admin added successfully" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to add admin", variant: "destructive" });
    }
  };

  const handleToggleStatus = async (admin: Admin) => {
    const action = admin.isActive ? deactivateAdmin : activateAdmin;
    const label = admin.isActive ? "deactivated" : "activated";
    try {
      await action(admin.id);
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      toast({ title: `Admin ${label}` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update admin status", variant: "destructive" });
    }
  };

  const handleRoleUpdate = async (adminId: number) => {
    try {
      await updateAdminRole(adminId, newRole);
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setEditingRole(null);
      toast({ title: "Role updated" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update role", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> Admin Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage admin users and their roles (Super Admin only)
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="h-4 w-4" /> Add Admin
        </button>
      </div>

      {/* Add Admin Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h3 className="text-sm font-semibold">Add New Admin</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Telegram ID *</label>
              <input
                type="text" value={form.telegramId}
                onChange={(e) => setForm({ ...form, telegramId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background mt-1"
                placeholder="123456789"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Name *</label>
              <input
                type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background mt-1"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background mt-1"
                placeholder="optional@email.com"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background mt-1"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Add Admin
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Admins Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">All Admins</h3>
          <span className="text-xs text-muted-foreground ml-auto">{admins.length} total</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading admins...</div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No admins found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/30">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Telegram ID</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Created</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin: Admin) => (
                <tr key={admin.id} className="border-b border-border hover:bg-muted/10">
                  <td className="px-4 py-3 font-medium">{admin.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{admin.telegramId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{admin.email || "—"}</td>
                  <td className="px-4 py-3">
                    {editingRole === admin.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="text-xs px-2 py-1 border border-border rounded bg-background"
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <button onClick={() => handleRoleUpdate(admin.id)} className="text-green-500 text-xs">
                          Save
                        </button>
                        <button onClick={() => setEditingRole(null)} className="text-red-500 text-xs">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingRole(admin.id); setNewRole(admin.role); }}
                        className="hover:opacity-80"
                      >
                        {getRoleBadge(admin.role)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${
                      admin.isActive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    }`}>
                      {admin.isActive ? (
                        <><CheckCircle2 className="h-3 w-3" /> Active</>
                      ) : (
                        <><XCircle className="h-3 w-3" /> Inactive</>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleStatus(admin)}
                      className={`text-xs px-3 py-1 rounded ${
                        admin.isActive
                          ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                          : "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                      }`}
                    >
                      {admin.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
