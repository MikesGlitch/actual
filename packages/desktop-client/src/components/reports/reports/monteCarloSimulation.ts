import type {
  MonteCarloAllocationPreset,
  MonteCarloWidget,
} from '@actual-app/core/types/models';

// Illustrative nominal annual return assumptions for the allocation presets.
// These are deliberately easy to tweak; they only auto-fill the mean/stdDev
// inputs in the UI - the simulation itself reads just the numeric values.
export const ALLOCATION_PRESETS: Record<
  Exclude<MonteCarloAllocationPreset, 'custom'>,
  { mean: number; stdDev: number }
> = {
  'equity-100': { mean: 0.07, stdDev: 0.15 },
  'equity-80': { mean: 0.065, stdDev: 0.12 },
  'equity-60': { mean: 0.06, stdDev: 0.1 },
  'equity-40': { mean: 0.05, stdDev: 0.075 },
  cash: { mean: 0.03, stdDev: 0.015 },
};

export const MIN_SIMULATION_COUNT = 1000;
export const MAX_SIMULATION_COUNT = 10000;
export const MIN_HORIZON_YEARS = 1;
export const MAX_HORIZON_YEARS = 100;

// Fixed PRNG seed so identical inputs always produce identical results -
// keeps the headline numbers stable across re-renders and tests exact.
export const DEFAULT_SIMULATION_SEED = 1234;

export const MONTE_CARLO_DEFAULTS = {
  startingBalance: 50_000_000, // 500,000.00 in minor units
  annualWithdrawal: 2_000_000, // 20,000.00 in minor units
  inflationRate: 0.025 as number | null,
  horizonYears: 30,
  allocationPreset: 'equity-60' as MonteCarloAllocationPreset,
  expectedReturnMean: ALLOCATION_PRESETS['equity-60'].mean,
  returnStdDev: ALLOCATION_PRESETS['equity-60'].stdDev,
  simulationCount: 5000,
};

/**
 * The full set of simulation settings the user can configure. Stored in the
 * widget meta; new configuration options (withdrawal rules, fees, ...) should
 * be added here so the configuration UI and the engine stay in sync.
 */
export type MonteCarloConfig = {
  startingBalance: number;
  annualWithdrawal: number;
  inflationRate: number | null;
  horizonYears: number;
  allocationPreset: MonteCarloAllocationPreset;
  expectedReturnMean: number;
  returnStdDev: number;
  simulationCount: number;
};

export function monteCarloConfigFromMeta(
  meta: MonteCarloWidget['meta'] | undefined,
): MonteCarloConfig {
  return {
    startingBalance:
      meta?.startingBalance ?? MONTE_CARLO_DEFAULTS.startingBalance,
    annualWithdrawal:
      meta?.annualWithdrawal ?? MONTE_CARLO_DEFAULTS.annualWithdrawal,
    inflationRate:
      meta?.inflationRate !== undefined
        ? meta.inflationRate
        : MONTE_CARLO_DEFAULTS.inflationRate,
    horizonYears: meta?.horizonYears ?? MONTE_CARLO_DEFAULTS.horizonYears,
    allocationPreset:
      meta?.allocationPreset ?? MONTE_CARLO_DEFAULTS.allocationPreset,
    expectedReturnMean:
      meta?.expectedReturnMean ?? MONTE_CARLO_DEFAULTS.expectedReturnMean,
    returnStdDev: meta?.returnStdDev ?? MONTE_CARLO_DEFAULTS.returnStdDev,
    simulationCount:
      meta?.simulationCount ?? MONTE_CARLO_DEFAULTS.simulationCount,
  };
}

export type MonteCarloParams = Omit<MonteCarloConfig, 'allocationPreset'> & {
  seed?: number;
};

export type MonteCarloPercentileBand = {
  /** 0 = starting point, 1..horizonYears = end of that year */
  year: number;
  p5: number;
  p10: number;
  p25: number;
  p30: number;
  p50: number;
  p70: number;
  p75: number;
  p90: number;
};

export type MonteCarloResult = {
  /** Fraction (0..1) of simulations that survived the full horizon */
  successRate: number;
  percentileBands: MonteCarloPercentileBand[];
  /** One entry per year 1..horizonYears; count of sims depleted in that year */
  depletionHistogram: Array<{ year: number; count: number }>;
  /** Cumulative depletion probability, indexed by year (0..horizonYears) */
  depletionProbabilityByYear: number[];
  /** Median ending balance across all simulations, in minor units */
  medianEndingBalance: number;
  /** Median depletion year among failed simulations, or null if none failed */
  medianDepletionYear: number | null;
  earliestDepletionYear: number | null;
  latestDepletionYear: number | null;
  /**
   * Balance path (year 0..horizonYears, minor units) of the single unluckiest
   * simulation: the one that ran out of money earliest, or the one with the
   * lowest ending balance if none ran out.
   */
  worstRunPath: number[];
  simulationCount: number;
  horizonYears: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Small deterministic PRNG (mulberry32) - no dependencies needed.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal draw via the Box-Muller transform.
function makeNormalSampler(random: () => number) {
  return function nextNormal() {
    // Avoid log(0) by shifting u1 into (0, 1]
    const u1 = 1 - random();
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
}

function percentileOfSorted(sorted: Float64Array, p: number) {
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Runs the drawdown simulation with i.i.d. normal annual returns.
 *
 * Each year, in each simulation: the withdrawal is taken at the start of the
 * year; if the pot can't cover it the simulation is marked depleted for that
 * year (balance clamped to 0 for the rest of the path); otherwise the year's
 * randomly drawn return is applied to the remaining balance. When an
 * inflation rate is set, next year's withdrawal grows by it. Returns are
 * nominal - inflation only grows withdrawals, so it is never double-counted.
 */
export function runMonteCarloSimulation(
  params: MonteCarloParams,
): MonteCarloResult {
  const startingBalance = Math.max(0, params.startingBalance);
  const annualWithdrawal = Math.max(0, params.annualWithdrawal);
  const inflationRate = params.inflationRate;
  const horizonYears = clamp(
    Math.round(params.horizonYears),
    MIN_HORIZON_YEARS,
    MAX_HORIZON_YEARS,
  );
  const meanReturn = params.expectedReturnMean;
  const stdDevReturn = Math.max(0, params.returnStdDev);
  const simulationCount = clamp(
    Math.round(params.simulationCount),
    MIN_SIMULATION_COUNT,
    MAX_SIMULATION_COUNT,
  );

  const random = mulberry32(params.seed ?? DEFAULT_SIMULATION_SEED);
  const nextNormal = makeNormalSampler(random);

  // Year-major balance buffers: balancesByYear[year][sim]
  const balancesByYear: Float64Array[] = [];
  for (let year = 0; year <= horizonYears; year++) {
    balancesByYear.push(new Float64Array(simulationCount));
  }

  const depletionCounts = new Array<number>(horizonYears + 1).fill(0);
  let survivedCount = 0;

  // The unluckiest simulation: earliest depletion, or lowest ending balance
  let worstSimIndex = 0;
  let worstDepletionYear = Infinity;
  let worstFinalBalance = Infinity;

  for (let sim = 0; sim < simulationCount; sim++) {
    let balance = startingBalance;
    let withdrawal = annualWithdrawal;
    let depleted = false;
    let simDepletionYear = Infinity;

    balancesByYear[0][sim] = balance;

    for (let year = 1; year <= horizonYears; year++) {
      if (!depleted) {
        balance -= withdrawal;
        if (balance <= 0) {
          balance = 0;
          depleted = true;
          simDepletionYear = year;
          depletionCounts[year]++;
        } else {
          balance *= 1 + meanReturn + stdDevReturn * nextNormal();
          if (balance <= 0) {
            // A sub-(-100%) return draw wiped the pot out
            balance = 0;
            depleted = true;
            simDepletionYear = year;
            depletionCounts[year]++;
          }
        }
        if (inflationRate != null) {
          withdrawal *= 1 + inflationRate;
        }
      }
      balancesByYear[year][sim] = balance;
    }

    if (!depleted) {
      survivedCount++;
    }

    if (
      simDepletionYear < worstDepletionYear ||
      (simDepletionYear === worstDepletionYear && balance < worstFinalBalance)
    ) {
      worstSimIndex = sim;
      worstDepletionYear = simDepletionYear;
      worstFinalBalance = balance;
    }
  }

  const worstRunPath: number[] = [];
  for (let year = 0; year <= horizonYears; year++) {
    worstRunPath.push(Math.round(balancesByYear[year][worstSimIndex]));
  }

  const percentileBands: MonteCarloPercentileBand[] = [];
  for (let year = 0; year <= horizonYears; year++) {
    const sorted = balancesByYear[year].slice().sort();
    percentileBands.push({
      year,
      p5: Math.round(percentileOfSorted(sorted, 0.05)),
      p10: Math.round(percentileOfSorted(sorted, 0.1)),
      p25: Math.round(percentileOfSorted(sorted, 0.25)),
      p30: Math.round(percentileOfSorted(sorted, 0.3)),
      p50: Math.round(percentileOfSorted(sorted, 0.5)),
      p70: Math.round(percentileOfSorted(sorted, 0.7)),
      p75: Math.round(percentileOfSorted(sorted, 0.75)),
      p90: Math.round(percentileOfSorted(sorted, 0.9)),
    });
  }

  const depletionHistogram: Array<{ year: number; count: number }> = [];
  for (let year = 1; year <= horizonYears; year++) {
    depletionHistogram.push({ year, count: depletionCounts[year] });
  }

  const depletionProbabilityByYear: number[] = [0];
  let cumulativeDepleted = 0;
  for (let year = 1; year <= horizonYears; year++) {
    cumulativeDepleted += depletionCounts[year];
    depletionProbabilityByYear.push(cumulativeDepleted / simulationCount);
  }

  const depletionYears: number[] = [];
  for (let year = 1; year <= horizonYears; year++) {
    for (let i = 0; i < depletionCounts[year]; i++) {
      depletionYears.push(year);
    }
  }

  const finalSorted = balancesByYear[horizonYears].slice().sort();

  return {
    successRate: survivedCount / simulationCount,
    percentileBands,
    depletionHistogram,
    depletionProbabilityByYear,
    medianEndingBalance: Math.round(percentileOfSorted(finalSorted, 0.5)),
    medianDepletionYear:
      depletionYears.length > 0
        ? depletionYears[Math.floor((depletionYears.length - 1) / 2)]
        : null,
    earliestDepletionYear: depletionYears.length > 0 ? depletionYears[0] : null,
    latestDepletionYear:
      depletionYears.length > 0
        ? depletionYears[depletionYears.length - 1]
        : null,
    worstRunPath,
    simulationCount,
    horizonYears,
  };
}
