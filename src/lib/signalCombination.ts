/**
 * Signal Combination (AND logic) for 2 conditions.
 *
 * Combines two independently-configured signal conditions with strict same-session AND logic.
 * Plain array intersection — no fuzzy proximity window.
 */

/**
 * Returns indices present in BOTH arrays — i.e. Condition A and Condition B fired
 * on the EXACT SAME session.
 *
 * @param signalsA Array of session indices where Condition A fired
 * @param signalsB Array of session indices where Condition B fired
 * @returns Array of session indices present in both arrays, sorted ascending.
 */
export function combineSignalsAND(signalsA: number[], signalsB: number[]): number[] {
  if (!signalsA || !signalsB || signalsA.length === 0 || signalsB.length === 0) {
    return [];
  }

  const setB = new Set(signalsB);
  const intersection: number[] = [];

  for (const idx of signalsA) {
    if (setB.has(idx)) {
      intersection.push(idx);
    }
  }

  // Deduplicate (in case inputs had duplicates) and sort ascending
  return Array.from(new Set(intersection)).sort((a, b) => a - b);
}

/**
 * Returns the total count of distinct sessions where either Condition A or Condition B fired individually.
 * Used to compute the plain-language comparison denominator ("in X of Y possible sessions").
 *
 * @param signalsA Array of session indices for Condition A
 * @param signalsB Array of session indices for Condition B
 * @returns Count of unique sessions in the union of both conditions.
 */
export function getUnionSessionCount(signalsA: number[], signalsB: number[]): number {
  const unionSet = new Set<number>();
  for (const idx of signalsA || []) {
    unionSet.add(idx);
  }
  for (const idx of signalsB || []) {
    unionSet.add(idx);
  }
  return unionSet.size;
}

/**
 * Formats the plain-language comparison line above the three result cards.
 * Computed dynamically, not hardcoded.
 */
export function formatCombinationComparisonLine(
  combinedCount: number,
  unionCount: number
): string {
  return `Combined occurred in ${combinedCount} of ${unionCount} possible sessions where either condition fired individually.`;
}
