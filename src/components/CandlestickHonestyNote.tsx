import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface CandlestickHonestyNoteProps {
  className?: string;
  compact?: boolean;
}

/**
 * Persistent honesty / scope note required for candlestick patterns:
 * "Candlestick patterns are noisier than moving-average or RSI signals — expect lower
 * and more volatile hit rates. Treat results with extra caution, especially below 10 occurrences."
 */
export const CandlestickHonestyNote: React.FC<CandlestickHonestyNoteProps> = ({
  className = '',
  compact = false,
}) => {
  return (
    <div
      id="candlestick-honesty-note"
      className={`flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/80 border border-amber-200/90 text-amber-900 ${className}`}
    >
      <div className="p-1 rounded-md bg-amber-100 text-amber-800 shrink-0 mt-0.5">
        <AlertTriangle className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      </div>
      <div className="text-xs space-y-0.5 leading-relaxed">
        <span className="font-semibold text-amber-950 block">
          Shape-Only Signal Notice:
        </span>
        <p className="text-amber-900">
          Candlestick patterns are noisier than moving-average or RSI signals — expect lower and more volatile hit rates. Treat results with extra caution, especially below 10 occurrences.
        </p>
      </div>
    </div>
  );
};
