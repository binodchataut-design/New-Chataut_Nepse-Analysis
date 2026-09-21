/**
 * Risk Controls & Position Sizing Engine
 * Phase 17: Pure-math position sizing calculator and pre-trade risk checks.
 *
 * Rules:
 * - Pure arithmetic, no invented risk models or 0-100 scores.
 * - Traceable arithmetic on numbers provided or from Phase 13 LiquidityMetrics.
 * - No trade blockers — informs the user with plain factual observations.
 * - Reuses existing open entries from TradeJournalEntry without new tables.
 */

import {
  TradeJournalEntry,
  LiquidityMetrics,
  PositionSizeResult,
  ConcentrationCheck,
  LiquidityFeasibilityCheck,
} from '../types';

/**
 * Calculates position size based on account capital, acceptable risk per trade (%),
 * entry price, and stop-loss price.
 *
 * Formula:
 * - riskAmount = accountSize * (riskPerTradePct / 100)
 * - riskPerShare = |entryPrice - stopLossPrice|
 * - shares = floor(riskAmount / riskPerShare)
 * - positionValue = shares * entryPrice
 * - positionPctOfAccount = (positionValue / accountSize) * 100
 */
export function calculatePositionSize(
  accountSize: number,
  riskPerTradePct: number,
  entryPrice: number,
  stopLossPrice: number
): PositionSizeResult {
  // Defensive checks for valid inputs
  if (isNaN(accountSize) || accountSize <= 0) {
    return {
      accountSize: isNaN(accountSize) ? 0 : accountSize,
      riskPerTradePct: isNaN(riskPerTradePct) ? 0 : riskPerTradePct,
      entryPrice: isNaN(entryPrice) ? 0 : entryPrice,
      stopLossPrice: isNaN(stopLossPrice) ? 0 : stopLossPrice,
      riskAmount: 0,
      riskPerShare: 0,
      shares: 0,
      positionValue: 0,
      positionPctOfAccount: 0,
      isValid: false,
      errorMessage: 'Account size must be greater than NPR 0.',
    };
  }

  if (isNaN(riskPerTradePct) || riskPerTradePct <= 0) {
    return {
      accountSize,
      riskPerTradePct: isNaN(riskPerTradePct) ? 0 : riskPerTradePct,
      entryPrice: isNaN(entryPrice) ? 0 : entryPrice,
      stopLossPrice: isNaN(stopLossPrice) ? 0 : stopLossPrice,
      riskAmount: 0,
      riskPerShare: 0,
      shares: 0,
      positionValue: 0,
      positionPctOfAccount: 0,
      isValid: false,
      errorMessage: 'Risk per trade must be greater than 0%.',
    };
  }

  if (isNaN(entryPrice) || entryPrice <= 0) {
    return {
      accountSize,
      riskPerTradePct,
      entryPrice: isNaN(entryPrice) ? 0 : entryPrice,
      stopLossPrice: isNaN(stopLossPrice) ? 0 : stopLossPrice,
      riskAmount: 0,
      riskPerShare: 0,
      shares: 0,
      positionValue: 0,
      positionPctOfAccount: 0,
      isValid: false,
      errorMessage: 'Entry price must be greater than NPR 0.',
    };
  }

  if (isNaN(stopLossPrice) || stopLossPrice <= 0) {
    return {
      accountSize,
      riskPerTradePct,
      entryPrice,
      stopLossPrice: isNaN(stopLossPrice) ? 0 : stopLossPrice,
      riskAmount: 0,
      riskPerShare: 0,
      shares: 0,
      positionValue: 0,
      positionPctOfAccount: 0,
      isValid: false,
      errorMessage: 'Stop-loss price must be greater than NPR 0.',
    };
  }

  const riskPerShare = Math.abs(entryPrice - stopLossPrice);

  // If riskPerShare <= 0, return error state (stop must differ from entry)
  if (riskPerShare <= 0) {
    return {
      accountSize,
      riskPerTradePct,
      entryPrice,
      stopLossPrice,
      riskAmount: accountSize * (riskPerTradePct / 100),
      riskPerShare: 0,
      shares: 0,
      positionValue: 0,
      positionPctOfAccount: 0,
      isValid: false,
      errorMessage: 'Stop-loss price must differ from entry price (risk per share cannot be zero).',
    };
  }

  const riskAmount = accountSize * (riskPerTradePct / 100);
  const shares = Math.floor(riskAmount / riskPerShare);
  const positionValue = shares * entryPrice;
  const positionPctOfAccount = accountSize > 0 ? (positionValue / accountSize) * 100 : 0;

  return {
    accountSize,
    riskPerTradePct,
    entryPrice,
    stopLossPrice,
    riskAmount,
    riskPerShare,
    shares,
    positionValue,
    positionPctOfAccount,
    isValid: true,
  };
}

/**
 * Checks overall capital exposure across active open positions plus a proposed new trade,
 * and detects whether the portfolio already has open positions in the same symbol.
 */
export function checkConcentration(
  existingOpenPositions: TradeJournalEntry[],
  newPositionValue: number,
  accountSize: number,
  newSymbol: string
): ConcentrationCheck {
  const openPositions = (existingOpenPositions || []).filter((e) => e.status === 'open');
  const openPositionsCount = openPositions.length;

  const existingOpenExposure = openPositions.reduce((acc, pos) => {
    const size = Number(pos.position_size) || 0;
    const price = Number(pos.entry_price) || 0;
    return acc + size * price;
  }, 0);

  const safeNewValue = isNaN(newPositionValue) || newPositionValue < 0 ? 0 : newPositionValue;
  const totalExposure = existingOpenExposure + safeNewValue;
  const totalExposurePct =
    accountSize > 0 && !isNaN(accountSize) ? (totalExposure / accountSize) * 100 : 0;

  const cleanSymbol = (newSymbol || '').trim().toUpperCase();
  const sameSymbolCount = cleanSymbol
    ? openPositions.filter((p) => p.symbol.trim().toUpperCase() === cleanSymbol).length
    : 0;

  const isHighExposure = totalExposurePct > 50;
  const hasSameSymbol = sameSymbolCount > 0;

  let explanation = '';
  if (openPositionsCount === 0) {
    explanation = safeNewValue > 0
      ? `This would be your first open position, utilizing ${totalExposurePct.toFixed(1)}% of your NPR ${accountSize.toLocaleString()} account.`
      : 'No open positions currently active.';
  } else {
    explanation = `${openPositionsCount} existing open position${openPositionsCount === 1 ? '' : 's'} (NPR ${existingOpenExposure.toLocaleString(undefined, { maximumFractionDigits: 2 })}) plus this proposed position (NPR ${safeNewValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}) total NPR ${totalExposure.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${totalExposurePct.toFixed(1)}% of account capital).`;
  }

  return {
    accountSize: isNaN(accountSize) ? 0 : accountSize,
    newPositionValue: safeNewValue,
    existingOpenExposure,
    totalExposure,
    totalExposurePct,
    openPositionsCount,
    sameSymbolCount,
    isHighExposure,
    hasSameSymbol,
    explanation,
  };
}

/**
 * Compares proposed share purchase against the stock's 20-session average daily trading volume.
 * Flags if position size exceeds 20% of typical daily volume (liquidity risk).
 */
export function checkLiquidityFeasibility(
  shares: number,
  liquidity: LiquidityMetrics | null | undefined
): LiquidityFeasibilityCheck {
  const symbol = liquidity?.symbol || '';
  const safeShares = isNaN(shares) || shares < 0 ? 0 : Math.floor(shares);

  if (!liquidity || !liquidity.has20SessionHistory || liquidity.avgVolume20 === null) {
    return {
      shares: safeShares,
      symbol,
      avgVolume20: null,
      positionAsPctOfDailyVolume: null,
      hasSufficientHistory: false,
      isHighVolumePct: false,
      message: 'Insufficient 20-session trading history to evaluate volume feasibility for this symbol.',
    };
  }

  const avgVolume20 = liquidity.avgVolume20;

  if (avgVolume20 <= 0) {
    return {
      shares: safeShares,
      symbol,
      avgVolume20: 0,
      positionAsPctOfDailyVolume: null,
      hasSufficientHistory: true,
      isHighVolumePct: true,
      message: 'Typical 20-session daily volume is 0 shares — this position cannot be liquidated under normal market conditions.',
    };
  }

  const positionAsPctOfDailyVolume = (safeShares / avgVolume20) * 100;
  const isHighVolumePct = positionAsPctOfDailyVolume > 20;

  let message = '';
  if (isHighVolumePct) {
    message = `This position size is ${positionAsPctOfDailyVolume.toFixed(1)}% of the stock's typical daily volume (${avgVolume20.toLocaleString()} shares/day) — may be difficult to enter or exit without moving the price.`;
  } else {
    message = `Position represents ${positionAsPctOfDailyVolume.toFixed(1)}% of 20-session average daily volume (${avgVolume20.toLocaleString()} shares/day).`;
  }

  return {
    shares: safeShares,
    symbol,
    avgVolume20,
    positionAsPctOfDailyVolume,
    hasSufficientHistory: true,
    isHighVolumePct,
    message,
  };
}
