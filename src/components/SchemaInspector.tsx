import React, { useState } from 'react';
import { Database, ChevronDown, ChevronRight, RefreshCw, Table, CheckCircle2, AlertCircle } from 'lucide-react';
import { IntrospectionReport } from '../types';

interface SchemaInspectorProps {
  report: IntrospectionReport | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const SchemaInspector: React.FC<SchemaInspectorProps> = ({
  report,
  isLoading,
  onRefresh,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTable, setActiveTable] = useState<'daily_prices' | 'companies' | 'market_index'>('daily_prices');

  if (!report && !isLoading) {
    return null;
  }

  const currentTable = report ? report[activeTable] : null;

  return (
    <div className="w-full bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left text-sm font-semibold text-neutral-800 hover:text-neutral-950 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          )}
          <Database className="w-4 h-4 text-neutral-600" />
          <span>Live Supabase Schema Introspection</span>
          {report && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20 font-medium font-mono">
              {report.companies.columns.length + report.daily_prices.columns.length + report.market_index.columns.length} columns discovered
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {report && (
            <span className="text-[11px] text-neutral-500 font-mono hidden sm:inline">
              Last checked: {new Date(report.timestamp).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs font-medium text-neutral-700 hover:text-neutral-900 px-2 py-1 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Re-inspect</span>
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && report && (
        <div className="p-4 space-y-4">
          {/* Table Switcher Tabs */}
          <div className="flex border-b border-neutral-200">
            {(['daily_prices', 'companies', 'market_index'] as const).map((tbl) => {
              const info = report[tbl];
              const isSelected = activeTable === tbl;
              const hasErr = Boolean(info.error);

              return (
                <button
                  key={tbl}
                  type="button"
                  onClick={() => setActiveTable(tbl)}
                  className={`px-4 py-2 text-xs font-mono font-medium border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
                    isSelected
                      ? 'border-neutral-900 text-neutral-900 bg-neutral-50/50'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>{tbl}</span>
                  {hasErr ? (
                    <AlertCircle className="w-3 h-3 text-rose-500" />
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-200/70 text-neutral-700 font-mono">
                      {info.columns.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Current Table Column Specs */}
          {currentTable && (
            <div className="space-y-3">
              {currentTable.error ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Table inspection error:</span> {currentTable.error}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-neutral-600">
                    <span className="font-semibold text-neutral-800 font-mono">
                      `{currentTable.tableName}` columns ({currentTable.columns.length})
                    </span>
                    <span className="text-[var(--success)] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Live schema verified
                    </span>
                  </div>

                  {/* Column Badges Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {currentTable.columns.map((col) => {
                      const type = currentTable.columnTypes[col] || 'unknown';
                      return (
                        <div
                          key={col}
                          className="p-2 bg-neutral-50 border border-neutral-200 rounded-md font-mono text-xs flex flex-col justify-between"
                        >
                          <span className="font-bold text-neutral-900 truncate" title={col}>
                            {col}
                          </span>
                          <span className="text-[10px] text-neutral-500 mt-1 uppercase tracking-wider">
                            {type}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sample Row Preview if available */}
                  {currentTable.sampleRow && (
                    <div className="mt-3 pt-3 border-t border-neutral-100">
                      <div className="text-xs font-semibold text-neutral-700 mb-1.5">
                        Sample Live Row from `{currentTable.tableName}`:
                      </div>
                      <pre className="p-3 bg-neutral-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto max-h-48">
                        {JSON.stringify(currentTable.sampleRow, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
