import React from 'react';
import { Sliders, Clock, ShieldAlert } from 'lucide-react';

export const BacktestPlaceholder: React.FC = () => {
  return (
    <div className="w-full bg-white border border-neutral-200 rounded-xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs space-y-4">
      <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center mx-auto">
        <Sliders className="w-6 h-6 text-neutral-500" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-neutral-900">
          Backtest Engine — Not Yet Available
        </h3>
        <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
          Systematic strategy backtesting with trade simulation, configurable stop-loss / profit targets, execution slippage, and chronological trade logs is scheduled for Phase 4.
        </p>
      </div>

      <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 text-left text-xs space-y-2 text-neutral-600">
        <div className="font-semibold text-neutral-800 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-neutral-500" />
          <span>Honest State Commitment</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          In accordance with our strict data integrity principles, no simulated equity curves, mock win rates, or fabricated backtest trades are presented. Real backtesting logic will be built directly against the verified <code className="font-mono text-neutral-800 bg-neutral-200/70 px-1 py-0.5 rounded">daily_prices</code> dataset.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-neutral-400">
        <Clock className="w-3.5 h-3.5" />
        <span>Status: Pending Phase 4 Backtesting Implementation</span>
      </div>
    </div>
  );
};
