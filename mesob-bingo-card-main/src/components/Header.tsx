import { Wallet, RefreshCw } from "lucide-react";

interface HeaderProps {
  balance?: number;
  onRefresh?: () => void;
  showBalance?: boolean;
}

const Header = ({ balance = 5, onRefresh, showBalance = true }: HeaderProps) => {
  const handleRefreshPage = () => {
    window.location.reload();
  };

  return (
    <header className="flex flex-col gap-1.5 px-2.5 pt-2 pb-1">
      {/* Top bar */}
      <div className="flex items-center justify-between py-1">
        <h1 className="text-sm font-bold text-foreground">Mesob Bingo</h1>
        
        <button 
          onClick={handleRefreshPage}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-foreground/70 hover:text-foreground hover:bg-card/50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Balance bar */}
      {showBalance && (
        <div className="flex items-center justify-between bg-card/50 border border-border/50 rounded-lg px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Balance</div>
              <div className="text-base font-bold text-foreground">{balance} ETB</div>
            </div>
          </div>
          
          <button 
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
