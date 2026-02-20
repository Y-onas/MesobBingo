import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
  AlertTriangle,
  Gamepad2,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/deposits", label: "Deposits", icon: ArrowDownCircle },
  { to: "/withdrawals", label: "Withdrawals", icon: ArrowUpCircle },
  { to: "/users", label: "Users", icon: Users },
  { to: "/fraud-alerts", label: "Fraud Alerts", icon: AlertTriangle },
  { to: "/game-rooms", label: "Game Rooms", icon: Gamepad2 },
  { to: "/audit-log", label: "Audit Log", icon: ClipboardList },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const adminName = localStorage.getItem("mesob_admin_name") || "Admin";
  const adminId = localStorage.getItem("mesob_admin_id") || "Unknown";

  const handleLogout = () => {
    localStorage.removeItem("mesob_admin_id");
    localStorage.removeItem("mesob_admin_name");
    localStorage.removeItem("mesob_admin_authenticated");
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            M
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold tracking-tight text-foreground">
                Mesob Bingo
              </h1>
              <p className="text-[10px] text-muted-foreground">Admin Dashboard</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              aria-label={label}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn(collapsed && "sr-only")}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Admin Info */}
        <div className="border-t border-border p-3">
          {!collapsed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                  {adminName.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="truncate text-xs font-medium">{adminName}</p>
                  <p className="truncate text-[10px] text-muted-foreground">ID: {adminId}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-3 w-3" />
                Logout
              </Button>
            </div>
          ) : (
            <button
              type="button"
              aria-label="Logout"
              onClick={handleLogout}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-10 items-center justify-center border-t border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
