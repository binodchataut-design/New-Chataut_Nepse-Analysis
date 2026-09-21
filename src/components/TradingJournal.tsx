import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  PlusCircle,
  CheckCircle2,
  Trash2,
  Edit3,
  Clock,
  AlertTriangle,
  RefreshCw,
  X,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import { Company, TradeJournalEntry, CreateJournalEntryInput, UpdateJournalEntryInput } from '../types';
import {
  getJournalEntries,
  createJournalEntry,
  closeJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  calculateTradeReturn,
  getTradeOutcome,
  calculateHoldingDays,
  computeJournalSummary,
} from '../lib/journalService';
import { SymbolPicker } from './SymbolPicker';

interface TradingJournalProps {
  companies: Company[];
  selectedSymbol: string;
}

export const TradingJournal: React.FC<TradingJournalProps> = ({
  companies,
  selectedSymbol,
}) => {
  const [entries, setEntries] = useState<TradeJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State for New Entry
  const [showNewForm, setShowNewForm] = useState<boolean>(false);
  const [formSymbol, setFormSymbol] = useState<string>(selectedSymbol || (companies[0]?.symbol ?? ''));
  const [formEntryDate, setFormEntryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [formEntryPrice, setFormEntryPrice] = useState<string>('');
  const [formStopLoss, setFormStopLoss] = useState<string>('');
  const [formTargetPrice, setFormTargetPrice] = useState<string>('');
  const [formPositionSize, setFormPositionSize] = useState<string>('');
  const [formSetupType, setFormSetupType] = useState<string>('');
  const [formEntryReason, setFormEntryReason] = useState<string>('');

  // Close Trade Modal State
  const [closingEntry, setClosingEntry] = useState<TradeJournalEntry | null>(null);
  const [closeExitDate, setCloseExitDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [closeExitPrice, setCloseExitPrice] = useState<string>('');
  const [closeLessonLearned, setCloseLessonLearned] = useState<string>('');

  // Edit Trade Modal State
  const [editingEntry, setEditingEntry] = useState<TradeJournalEntry | null>(null);
  const [editForm, setEditForm] = useState<UpdateJournalEntryInput>({});

  // Delete Confirmation Modal State
  const [deletingEntry, setDeletingEntry] = useState<TradeJournalEntry | null>(null);

  // Load entries from Supabase
  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const data = await getJournalEntries();
      setEntries(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Sync symbol picker default if user changes symbol in another tab
  useEffect(() => {
    if (selectedSymbol && !formSymbol) {
      setFormSymbol(selectedSymbol);
    }
  }, [selectedSymbol, formSymbol]);

  // Summary Metrics
  const summary = useMemo(() => computeJournalSummary(entries), [entries]);

  const openPositions = useMemo(
    () => entries.filter((e) => e.status === 'open'),
    [entries]
  );

  const closedTrades = useMemo(
    () => entries.filter((e) => e.status === 'closed'),
    [entries]
  );

  // Handle New Entry Submission
  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    const price = parseFloat(formEntryPrice);
    if (isNaN(price) || price <= 0) {
      setActionError('Entry price must be a valid positive number.');
      return;
    }

    if (!formSymbol.trim()) {
      setActionError('Please select or specify a valid symbol.');
      return;
    }

    if (!formEntryReason.trim()) {
      setActionError('Entry reason is required to document trade rationale.');
      return;
    }

    const payload: CreateJournalEntryInput = {
      symbol: formSymbol.trim().toUpperCase(),
      entry_date: formEntryDate,
      entry_price: price,
      stop_loss: formStopLoss ? parseFloat(formStopLoss) : null,
      target_price: formTargetPrice ? parseFloat(formTargetPrice) : null,
      position_size: formPositionSize ? parseFloat(formPositionSize) : null,
      setup_type: formSetupType.trim() ? formSetupType.trim() : null,
      entry_reason: formEntryReason.trim(),
      status: 'open',
    };

    setIsSubmitting(true);
    try {
      const created = await createJournalEntry(payload);
      setEntries((prev) => [created, ...prev]);
      setActionSuccess(`Logged open position for ${created.symbol} at NPR ${created.entry_price.toFixed(2)}.`);
      // Reset form
      setFormEntryPrice('');
      setFormStopLoss('');
      setFormTargetPrice('');
      setFormPositionSize('');
      setFormSetupType('');
      setFormEntryReason('');
      setShowNewForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open "Close Trade" Dialog
  const openCloseModal = (entry: TradeJournalEntry) => {
    setClosingEntry(entry);
    setCloseExitDate(new Date().toISOString().split('T')[0]);
    setCloseExitPrice('');
    setCloseLessonLearned('');
    setActionError(null);
  };

  // Handle Confirm Close Trade
  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingEntry) return;

    const exitPriceNum = parseFloat(closeExitPrice);
    if (isNaN(exitPriceNum) || exitPriceNum <= 0) {
      setActionError('Exit price must be a positive number.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const updated = await closeJournalEntry(
        closingEntry.id,
        closeExitDate,
        exitPriceNum,
        closeLessonLearned
      );
      setEntries((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      const ret = calculateTradeReturn(updated);
      const retStr = ret !== null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` : '';
      setActionSuccess(`Closed trade for ${updated.symbol} with return of ${retStr}.`);
      setClosingEntry(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (entry: TradeJournalEntry) => {
    setEditingEntry(entry);
    setEditForm({
      symbol: entry.symbol,
      entry_date: entry.entry_date,
      entry_price: entry.entry_price,
      exit_date: entry.exit_date,
      exit_price: entry.exit_price,
      stop_loss: entry.stop_loss,
      target_price: entry.target_price,
      position_size: entry.position_size,
      setup_type: entry.setup_type,
      entry_reason: entry.entry_reason,
      lesson_learned: entry.lesson_learned,
      status: entry.status,
    });
    setActionError(null);
  };

  // Handle Save Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    setIsSubmitting(true);
    setActionError(null);
    try {
      const updated = await updateJournalEntry(editingEntry.id, editForm);
      setEntries((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setActionSuccess(`Updated journal entry for ${updated.symbol}.`);
      setEditingEntry(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Entry
  const handleDeleteSubmit = async () => {
    if (!deletingEntry) return;

    setIsSubmitting(true);
    setActionError(null);
    try {
      await deleteJournalEntry(deletingEntry.id);
      setEntries((prev) => prev.filter((item) => item.id !== deletingEntry.id));
      setActionSuccess(`Permanently removed trade entry for ${deletingEntry.symbol}.`);
      setDeletingEntry(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="trading-journal-container" className="space-y-6">
      {/* 1. Header & Summary Strip */}
      <section
        id="journal-summary-strip"
        className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-neutral-900 text-white rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 leading-tight">
                Trading Journal
              </h2>
              <p className="text-xs text-neutral-500">
                Log real positions, document execution rationale, and audit post-trade outcomes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="refresh-journal-btn"
              onClick={loadEntries}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh journal records from Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              id="toggle-new-entry-btn"
              onClick={() => setShowNewForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 active:bg-black rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{showNewForm ? 'Close Form' : 'New Entry'}</span>
            </button>
          </div>
        </div>

        {/* Aggregate Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Open Positions Count */}
          <div
            id="metric-open-positions"
            className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-between"
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Open Positions
              </div>
              <div className="text-2xl font-bold font-mono text-neutral-900 mt-0.5">
                {summary.totalOpen}
              </div>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          {/* Closed Trades Count */}
          <div
            id="metric-closed-trades"
            className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-between"
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Closed Trades
              </div>
              <div className="text-2xl font-bold font-mono text-neutral-900 mt-0.5">
                {summary.totalClosed}
              </div>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Win Rate Among Closed Trades */}
          <div
            id="metric-win-rate"
            className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-between"
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Closed Trade Win Rate
              </div>
              <div className="text-2xl font-bold font-mono text-neutral-900 mt-0.5">
                {summary.winRate !== null ? (
                  <span>{summary.winRate.toFixed(1)}%</span>
                ) : (
                  <span className="text-base text-neutral-500">N/A</span>
                )}
              </div>
              <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                {summary.totalClosed > 0
                  ? `${summary.winCount} of ${summary.totalClosed} won`
                  : '0 closed trades logged'}
              </div>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-200">
              <Target className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Honest Notice */}
        <div className="text-[11px] text-neutral-500 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 flex items-start gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
          <span>
            <strong>Honesty Rule:</strong> Win rate is computed strictly at display time from closed trades (return &gt; 0).
            Open positions have no outcome or paper return calculated until closed. No expected probability is fabricated.
          </span>
        </div>
      </section>

      {/* Real-time Alerts */}
      {actionError && (
        <div
          id="journal-error-banner"
          className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold">Supabase Operation Failed:</span>
            <p className="font-mono text-rose-900">{actionError}</p>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="ml-auto text-rose-500 hover:text-rose-700 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div
          id="journal-success-banner"
          className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. New Entry Form Card */}
      {showNewForm && (
        <section
          id="new-trade-entry-form-card"
          className="bg-white border border-neutral-300 rounded-xl p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-neutral-800" />
              <h3 className="text-sm font-bold text-neutral-900">Log New Trade Position</h3>
            </div>
            <button
              onClick={() => setShowNewForm(false)}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateEntry} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* Symbol */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Symbol <span className="text-rose-500">*</span>
                </label>
                {companies.length > 0 ? (
                  <div className="relative">
                    <SymbolPicker
                      companies={companies}
                      selectedSymbol={formSymbol}
                      onSelectSymbol={(sym) => setFormSymbol(sym)}
                      isLoading={false}
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    required
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. NABIL"
                    className="w-full px-3 py-1.5 text-xs font-mono font-medium border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-hidden"
                  />
                )}
              </div>

              {/* Entry Date */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Entry Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formEntryDate}
                  onChange={(e) => setFormEntryDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-hidden"
                />
              </div>

              {/* Entry Price */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Entry Price (NPR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 520.00"
                  value={formEntryPrice}
                  onChange={(e) => setFormEntryPrice(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-hidden"
                />
              </div>

              {/* Position Size */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Position Size (Shares)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 100"
                  value={formPositionSize}
                  onChange={(e) => setFormPositionSize(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-hidden"
                />
              </div>

              {/* Stop Loss */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Stop Loss (NPR)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 495.00"
                  value={formStopLoss}
                  onChange={(e) => setFormStopLoss(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-hidden"
                />
              </div>

              {/* Target Price */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Target Price (NPR)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 560.00"
                  value={formTargetPrice}
                  onChange={(e) => setFormTargetPrice(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-hidden"
                />
              </div>

              {/* Setup Type */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Setup Type (Free text)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SMA20/50 cross, Hammer, RSI recovery, Resistance breakout"
                  value={formSetupType}
                  onChange={(e) => setFormSetupType(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Entry Reason */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Entry Reason &amp; Trade Plan <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Describe your rationale: technical trigger, volume confirmation, risk/reward plan, key market conditions..."
                value={formEntryReason}
                onChange={(e) => setFormEntryReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-hidden"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 active:bg-black rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Supabase...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Position to Supabase</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 3. Open Positions Table */}
      <section
        id="open-positions-section"
        className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-3"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-neutral-900">
              Open Positions ({openPositions.length})
            </h3>
          </div>
          <span className="text-[11px] text-neutral-500 font-mono">
            Active holdings awaiting resolution
          </span>
        </div>

        {openPositions.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500 bg-neutral-50 rounded-lg border border-neutral-100">
            No open positions currently logged. Click <strong>New Entry</strong> to record a trade.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-700">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold border-y border-neutral-200">
                <tr>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Entry Date</th>
                  <th className="py-2.5 px-3 font-mono text-right">Entry (NPR)</th>
                  <th className="py-2.5 px-3 font-mono text-right">Stop Loss</th>
                  <th className="py-2.5 px-3 font-mono text-right">Target</th>
                  <th className="py-2.5 px-3 font-mono text-right">Size</th>
                  <th className="py-2.5 px-3">Setup</th>
                  <th className="py-2.5 px-3">Entry Reason</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {openPositions.map((entry) => (
                  <tr key={entry.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-bold font-mono text-neutral-900">
                      {entry.symbol}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-neutral-600">{entry.entry_date}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-neutral-900 text-right">
                      {entry.entry_price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-rose-700 text-right">
                      {entry.stop_loss !== null ? entry.stop_loss.toFixed(2) : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-700 text-right">
                      {entry.target_price !== null ? entry.target_price.toFixed(2) : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-neutral-600 text-right">
                      {entry.position_size !== null ? entry.position_size.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-700">
                      {entry.setup_type ? (
                        <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[11px] font-medium">
                          {entry.setup_type}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600 max-w-xs truncate" title={entry.entry_reason}>
                      {entry.entry_reason}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openCloseModal(entry)}
                          className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors cursor-pointer"
                          title="Record exit and close position"
                        >
                          Close Trade
                        </button>
                        <button
                          onClick={() => openEditModal(entry)}
                          className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                          title="Edit trade details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingEntry(entry)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Delete trade"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Closed Trades Table */}
      <section
        id="closed-trades-section"
        className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-3"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-neutral-900">
              Closed Trades ({closedTrades.length})
            </h3>
          </div>
          <span className="text-[11px] text-neutral-500 font-mono">
            {summary.winRate !== null
              ? `Win Rate: ${summary.winRate.toFixed(1)}% (${summary.winCount}/${summary.totalClosed})`
              : '0 closed trades'}
          </span>
        </div>

        {closedTrades.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500 bg-neutral-50 rounded-lg border border-neutral-100">
            No closed trades logged yet. Close an open position to record its outcome and lessons learned.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-700">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold border-y border-neutral-200">
                <tr>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Entry</th>
                  <th className="py-2.5 px-3">Exit</th>
                  <th className="py-2.5 px-3 font-mono text-right">Return %</th>
                  <th className="py-2.5 px-3 text-center">Outcome</th>
                  <th className="py-2.5 px-3 font-mono text-center">Holding</th>
                  <th className="py-2.5 px-3">Setup</th>
                  <th className="py-2.5 px-3">Lesson Learned</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {closedTrades.map((entry) => {
                  const ret = calculateTradeReturn(entry);
                  const outcome = getTradeOutcome(entry);
                  const holdingDays = calculateHoldingDays(entry);

                  return (
                    <tr key={entry.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-bold font-mono text-neutral-900">
                        {entry.symbol}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <div className="text-neutral-900 font-medium">{entry.entry_price.toFixed(2)}</div>
                        <div className="text-[10px] text-neutral-500">{entry.entry_date}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <div className="text-neutral-900 font-medium">
                          {entry.exit_price !== null ? entry.exit_price.toFixed(2) : '—'}
                        </div>
                        <div className="text-[10px] text-neutral-500">{entry.exit_date ?? '—'}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-right">
                        {ret !== null ? (
                          <span className={ret > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {ret >= 0 ? '+' : ''}
                            {ret.toFixed(2)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {outcome === 'Win' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold text-[10px]">
                            <TrendingUp className="w-3 h-3" /> Win
                          </span>
                        ) : outcome === 'Loss' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-full font-bold text-[10px]">
                            <TrendingDown className="w-3 h-3" /> Loss
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-neutral-600 text-center">
                        {holdingDays !== null ? `${holdingDays}d` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-700">
                        {entry.setup_type ? (
                          <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[11px] font-medium">
                            {entry.setup_type}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600 max-w-xs truncate" title={entry.lesson_learned || entry.entry_reason}>
                        {entry.lesson_learned ? (
                          <span className="text-neutral-800 font-medium">{entry.lesson_learned}</span>
                        ) : (
                          <span className="text-neutral-400 italic">None noted</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(entry)}
                            className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                            title="Edit trade details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingEntry(entry)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Delete trade"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. Modal: Close Trade */}
      {closingEntry && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-300 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Close Position: {closingEntry.symbol}
                </h3>
              </div>
              <button
                onClick={() => setClosingEntry(null)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-500">Entry Date:</span>
                <span className="font-mono font-medium text-neutral-900">{closingEntry.entry_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Entry Price:</span>
                <span className="font-mono font-medium text-neutral-900">NPR {closingEntry.entry_price.toFixed(2)}</span>
              </div>
              {closingEntry.setup_type && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Setup:</span>
                  <span className="font-medium text-neutral-800">{closingEntry.setup_type}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleCloseSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Exit Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={closeExitDate}
                  onChange={(e) => setCloseExitDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Exit Price (NPR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 545.00"
                  value={closeExitPrice}
                  onChange={(e) => setCloseExitPrice(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-hidden"
                />
              </div>

              {/* Dynamic Preview of Return % */}
              {closeExitPrice && !isNaN(parseFloat(closeExitPrice)) && parseFloat(closeExitPrice) > 0 && (
                <div className="p-2.5 bg-neutral-100 rounded-lg border border-neutral-200 text-xs flex items-center justify-between">
                  <span className="text-neutral-600 font-medium">Computed Return:</span>
                  {(() => {
                    const ep = parseFloat(closeExitPrice);
                    const ret = ((ep - closingEntry.entry_price) / closingEntry.entry_price) * 100;
                    return (
                      <span className={`font-mono font-bold ${ret > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {ret >= 0 ? '+' : ''}
                        {ret.toFixed(2)}% ({ret > 0 ? 'Win' : 'Loss'})
                      </span>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Lesson Learned / Post-Trade Review
                </label>
                <textarea
                  rows={2}
                  placeholder="What worked? What could be improved? Did price hit stop or target?"
                  value={closeLessonLearned}
                  onChange={(e) => setCloseLessonLearned(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClosingEntry(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Closing...' : 'Confirm & Close Trade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Edit Trade */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-300 shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-neutral-800" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Edit Journal Entry: {editingEntry.symbol}
                </h3>
              </div>
              <button
                onClick={() => setEditingEntry(null)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Status</label>
                  <select
                    value={editForm.status || 'open'}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as 'open' | 'closed' }))}
                    className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900"
                  >
                    <option value="open">Open Position</option>
                    <option value="closed">Closed Trade</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Symbol</label>
                  <input
                    type="text"
                    value={editForm.symbol ?? ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, symbol: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Entry Date</label>
                  <input
                    type="date"
                    value={editForm.entry_date ?? ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, entry_date: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Entry Price</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.entry_price ?? ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, entry_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md"
                  />
                </div>
              </div>

              {editForm.status === 'closed' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Exit Date</label>
                    <input
                      type="date"
                      value={editForm.exit_date ?? ''}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, exit_date: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Exit Price</label>
                    <input
                      type="number"
                      step="any"
                      value={editForm.exit_price ?? ''}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, exit_price: parseFloat(e.target.value) || null }))}
                      className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Stop Loss</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.stop_loss ?? ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, stop_loss: e.target.value ? parseFloat(e.target.value) : null }))}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Target</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.target_price ?? ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, target_price: e.target.value ? parseFloat(e.target.value) : null }))}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Size</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.position_size ?? ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, position_size: e.target.value ? parseFloat(e.target.value) : null }))}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Setup Type</label>
                <input
                  type="text"
                  value={editForm.setup_type ?? ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, setup_type: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Entry Reason</label>
                <textarea
                  rows={2}
                  value={editForm.entry_reason ?? ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, entry_reason: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Lesson Learned</label>
                <textarea
                  rows={2}
                  value={editForm.lesson_learned ?? ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lesson_learned: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 active:bg-black rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Delete Confirmation */}
      {deletingEntry && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-300 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-lg shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Delete Journal Entry</h3>
                <p className="text-xs text-neutral-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-neutral-700 leading-relaxed">
              Are you sure you want to permanently delete the trade entry for{' '}
              <strong className="font-mono text-neutral-900">{deletingEntry.symbol}</strong> entered on{' '}
              <span className="font-mono font-medium">{deletingEntry.entry_date}</span>?
              This will remove the record directly from Supabase.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingEntry(null)}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 active:bg-rose-900 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete From Supabase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
