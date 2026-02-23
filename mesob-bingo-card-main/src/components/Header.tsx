import { Wallet, RefreshCw } from "lucide-react";

interface HeaderProps {
  balance?: number;
  withdrawable?: number;
  playing?: number;
  onRefresh?: () => void;
  showBalance?: boolean;
}

const Header = ({ balance = 0, withdrawable, playing, onRefresh, showBalance = true }: HeaderProps) => {
  // Use new balance breakdown if available, otherwise fall back to total
  const showBreakdown = withdrawable !== undefined && playing !== undefined;
  
  const handlePageReload = () => {
    window.location.reload();
  };
  
  return (
    <header className="flex flex-col gap-1 px-2.5 pt-1.5 pb-0.5">
      {/* Top bar */}
      <div className="flex items-center justify-between py-0.5">
        <h1 className="text-sm font-bold text-foreground">Mesob Bingo</h1>
        <button 
          onClick={handlePageReload}
          className="px-2.5 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20"
          title="Reload page"
          aria-label="Refresh"
          type="button"
        >
          <span className="text-[10px] font-semibold text-primary">Refresh</span>
        </button>
      </div>

      {/* Balance Card - Very Compact */}
      {showBalance && (
        <div className="bg-card/50 border border-border/50 rounded-lg p-2">
          {/* Header with icon, label and refresh */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center">
                <Wallet className="w-2.5 h-2.5 text-primary" />
              </div>
              <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">Total Balance</span>
            </div>
            <button 
              onClick={onRefresh}
              className="p-0.5 rounded bg-muted/50 hover:bg-muted transition-colors"
              title="Update balance"
              aria-label="Update Balance"
              type="button"
            >
              <RefreshCw className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>

          {/* Total Balance - Very Compact */}
          <div className="text-center mb-1.5">
            <div className="text-xl font-bold text-foreground tracking-tight leading-none">
              {balance.toLocaleString()}
            </div>
            <div className="text-[9px] text-muted-foreground">ETB</div>
          </div>

          {/* Balance Breakdown - Compact Cards */}
          {showBreakdown && (
            <div className="grid grid-cols-2 gap-1.5">
              {/* Withdrawable */}
              <div className="bg-success/10 border border-success/20 rounded-md p-1.5">
                <div className="flex items-center gap-0.5 mb-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-success/20 flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-success"></div>
                  </div>
                  <span className="text-[7px] font-semibold uppercase tracking-wide text-success">Withdrawable</span>
                </div>
                <div className="text-sm font-bold text-success">
                  {withdrawable?.toLocaleString() || '0'}
                </div>
              </div>

              {/* Playing - Yellow */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-1.5">
                <div className="flex items-center gap-0.5 mb-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-yellow-500"></div>
                  </div>
                  <span className="text-[7px] font-semibold uppercase tracking-wide text-yellow-500">Playing</span>
                </div>
                <div className="text-sm font-bold text-yellow-500">
                  {playing?.toLocaleString() || '0'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
