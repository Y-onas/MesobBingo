import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [telegramId, setTelegramId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!telegramId.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Telegram ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Login with backend to get JWT token
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ telegramId }),
      });

      const data = await response.json();

      if (response.ok && data.isAdmin && data.token) {
        // Store JWT token and admin info in localStorage
        localStorage.setItem("mesob_admin_token", data.token);
        localStorage.setItem("mesob_admin_id", telegramId);
        localStorage.setItem("mesob_admin_name", data.name || "Admin");
        localStorage.setItem("mesob_admin_authenticated", "true");
        
        toast({
          title: "Login Successful",
          description: `Welcome, ${data.name || "Admin"}!`,
        });
        
        navigate("/");
      } else {
        toast({
          title: "Access Denied",
          description: data.error || "You are not authorized as an admin",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify admin credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="glass-card p-8 rounded-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Mesob Bingo</h1>
            <p className="text-muted-foreground">Admin Dashboard Login</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="telegramId" className="block text-sm font-medium text-foreground mb-2">
                Telegram ID
              </label>
              <Input
                id="telegramId"
                type="text"
                placeholder="Enter your Telegram ID"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                className="bg-muted border-border"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Use your Telegram user ID to login
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Only authorized admins can access this dashboard
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
