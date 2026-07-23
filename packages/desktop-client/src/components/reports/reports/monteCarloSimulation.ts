import type {
  MonteCarloAllocationPreset,
  MonteCarloPotMeta,
  MonteCarloReturnModel,
  MonteCarloWidget,
  MonteCarloWithdrawalRuleMeta,
  MonteCarloWithdrawalStrategy,
} from '@actual-app/core/types/models';

import { HISTORICAL_ANNUAL_RETURNS } from './monteCarloHistoricalReturns';
import type { HistoricalAnnualReturn } from './monteCarloHistoricalReturns';

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

// Asset mix behind each preset, used by the historical return models to
// blend the stocks/bonds/cash series into a single yearly return per pot
export const PRESET_ASSET_WEIGHTS: Record<
  Exclude<MonteCarloAllocationPreset, 'custom'>,
  { stocks: number; bonds: number; cash: number }
> = {
  'equity-100': { stocks: 1, bonds: 0, cash: 0 },
  'equity-80': { stocks: 0.8, bonds: 0.2, cash: 0 },
  'equity-60': { stocks: 0.6, bonds: 0.4, cash: 0 },
  'equity-40': { stocks: 0.4, bonds: 0.6, cash: 0 },
  cash: { stocks: 0, bonds: 0, cash: 1 },
};

export const MIN_SIMULATION_COUNT = 1000;
export const MAX_SIMULATION_COUNT = 10000;
export const MIN_HORIZON_YEARS = 1;
export const MAX_HORIZON_YEARS = 100;

// Fixed PRNG seed so identical inputs always produce identical results -
// keeps the headline numbers stable across re-renders and tests exact.
export const DEFAULT_SIMULATION_SEED = 1234;

/** One invested pot with its own balance and return assumptions */
export type MonteCarloPot = {
  id: string;
  name: string;
  startingBalance: number; // integer minor units (cents)
  allocationPreset: MonteCarloAllocationPreset;
  expectedReturnMean: number; // decimal fraction
  returnStdDev: number; // decimal fraction
};

export function createMonteCarloPot(id: string): MonteCarloPot {
  return {
    id,
    name: '',
    startingBalance: 50_000_000, // 500,000.00 in minor units
    allocationPreset: 'equity-60',
    expectedReturnMean: ALLOCATION_PRESETS['equity-60'].mean,
    returnStdDev: ALLOCATION_PRESETS['equity-60'].stdDev,
  };
}

/**
 * The full set of simulation settings the user can configure. Stored in the
 * widget meta; new configuration options (withdrawal rules, fees, ...) should
 * be added here so the configuration UI and the engine stay in sync.
 */
/** Fully-populated withdrawal rule settings; `type` picks the active rule */
export type MonteCarloWithdrawalRuleConfig =
  Required<MonteCarloWithdrawalRuleMeta>;

export const WITHDRAWAL_RULE_DEFAULTS: MonteCarloWithdrawalRuleConfig = {
  type: 'none',
  // Guardrails (Guyton-Klinger's canonical 20% bands with 10% adjustments)
  prosperityTriggerPct: 0.2,
  prosperityIncreasePct: 0.1,
  preservationTriggerPct: 0.2,
  preservationCutPct: 0.1,
  // Ratcheting (Kitces)
  balanceThresholdMultiple: 1.5,
  consecutiveYears: 3,
  ratchetIncreasePct: 0.05,
  // Floor & ceiling (Bengen)
  floorPct: 0.15,
  ceilingPct: 0.2,
  // Boundaries
  upperRateThreshold: 0.06,
  upperCutPct: 0.1,
  lowerRateThreshold: 0.04,
  lowerIncreasePct: 0.05,
};

export type MonteCarloConfig = {
  pots: MonteCarloPot[];
  /** How the annual withdrawal is taken across pots */
  withdrawalStrategy: MonteCarloWithdrawalStrategy;
  /**
   * How yearly returns are generated: random normal draws, random samples
   * of historical years, or replays of actual historical sequences
   */
  returnModel: MonteCarloReturnModel;
  /** Dynamic withdrawal adjustment rule applied at the start of each year */
  withdrawalRule: MonteCarloWithdrawalRuleConfig;
  /** Minimum annual withdrawal in minor units; 0 = no floor */
  minimumWithdrawal: number;
  annualWithdrawal: number;
  inflationRate: number | null;
  horizonYears: number;
  simulationCount: number;
};

export const MONTE_CARLO_DEFAULTS: MonteCarloConfig = {
  pots: [createMonteCarloPot('pot-1')],
  withdrawalStrategy: 'proportional',
  returnModel: 'normal',
  withdrawalRule: WITHDRAWAL_RULE_DEFAULTS,
  minimumWithdrawal: 0,
  annualWithdrawal: 2_000_000, // 20,000.00 in minor units
  inflationRate: 0.025,
  horizonYears: 30,
  simulationCount: 5000,
};

function potFromMeta(potMeta: MonteCarloPotMeta, index: number): MonteCarloPot {
  const defaults = createMonteCarloPot(potMeta.id || `pot-${index + 1}`);
  return {
    ...defaults,
    name: potMeta.name ?? defaults.name,
    startingBalance: potMeta.startingBalance ?? defaults.startingBalance,
    allocationPreset: potMeta.allocationPreset ?? defaults.allocationPreset,
    expectedReturnMean:
      potMeta.expectedReturnMean ?? defaults.expectedReturnMean,
    returnStdDev: potMeta.returnStdDev ?? defaults.returnStdDev,
  };
}

export function monteCarloConfigFromMeta(
  meta: MonteCarloWidget['meta'] | undefined,
): MonteCarloConfig {
  return {
    pots: meta?.pots?.length
      ? meta.pots.map(potFromMeta)
      : [createMonteCarloPot('pot-1')],
    withdrawalStrategy:
      meta?.withdrawalStrategy ?? MONTE_CARLO_DEFAULTS.withdrawalStrategy,
    returnModel: meta?.returnModel ?? MONTE_CARLO_DEFAULTS.returnModel,
    withdrawalRule: { ...WITHDRAWAL_RULE_DEFAULTS, ...meta?.withdrawalRule },
    minimumWithdrawal:
      meta?.minimumWithdrawal ?? MONTE_CARLO_DEFAULTS.minimumWithdrawal,
    annualWithdrawal:
      meta?.annualWithdrawal ?? MONTE_CARLO_DEFAULTS.annualWithdrawal,
    inflationRate:
      meta?.inflationRate !== undefined
        ? meta.inflationRate
        : MONTE_CARLO_DEFAULTS.inflationRate,
    horizonYears: meta?.horizonYears ?? MONTE_CARLO_DEFAULTS.horizonYears,
    simulationCount:
      meta?.simulationCount ?? MONTE_CARLO_DEFAULTS.simulationCount,
  };
}

export type MonteCarloParams = MonteCarloConfig & {
  seed?: number;
  /** Override the bundled historical dataset (used in tests) */
  historicalReturns?: HistoricalAnnualReturn[];
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
  /**
   * Median across simulations of the total amount actually withdrawn over
   * the horizon, in minor units - shows the income cost of withdrawal rules
   */
  medianTotalWithdrawn: number;
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
 * year across all pots (proportionally to their balances, or draining pots in
 * order); if the pots together can't cover it the simulation is marked
 * depleted for that year (balances clamped to 0 for the rest of the path);
 * otherwise each pot gets its own randomly drawn return for the year. When an
 * inflation rate is set, next year's withdrawal grows by it. Returns are
 * nominal - inflation only grows withdrawals, so it is never double-counted.
 * Pot returns are drawn independently (no cross-pot correlation).
 */
export function runMonteCarloSimulation(
  params: MonteCarloParams,
): MonteCarloResult {
  const pots = params.pots.length > 0 ? params.pots : MONTE_CARLO_DEFAULTS.pots;
  const potCount = pots.length;
  const potStartBalances = pots.map(pot => Math.max(0, pot.startingBalance));
  const potMeans = pots.map(pot => pot.expectedReturnMean);
  const potStdDevs = pots.map(pot => Math.max(0, pot.returnStdDev));
  const isSequential = params.withdrawalStrategy === 'sequential';

  const returnModel = params.returnModel;
  const history = params.historicalReturns?.length
    ? params.historicalReturns
    : HISTORICAL_ANNUAL_RETURNS;
  const historyCount = history.length;

  // For historical models, each preset pot gets the blended return of its
  // asset mix in every historical year. 'custom' pots have no asset mix, so
  // they keep using normal draws around their own mean/volatility.
  const potHistoricalReturns: Array<Float64Array | null> = pots.map(pot => {
    if (returnModel === 'normal' || pot.allocationPreset === 'custom') {
      return null;
    }
    const weights = PRESET_ASSET_WEIGHTS[pot.allocationPreset];
    const blended = new Float64Array(historyCount);
    for (let i = 0; i < historyCount; i++) {
      blended[i] =
        weights.stocks * history[i].stocks +
        weights.bonds * history[i].bonds +
        weights.cash * history[i].cash;
    }
    return blended;
  });

  const annualWithdrawal = Math.max(0, params.annualWithdrawal);
  const inflationRate = params.inflationRate;
  const horizonYears = clamp(
    Math.round(params.horizonYears),
    MIN_HORIZON_YEARS,
    MAX_HORIZON_YEARS,
  );
  // Sequence replay runs exactly one scenario per historical start year
  // (wrapping around the end of the dataset); the simulation count input
  // doesn't apply there
  const simulationCount =
    returnModel === 'historical-sequence'
      ? historyCount
      : clamp(
          Math.round(params.simulationCount),
          MIN_SIMULATION_COUNT,
          MAX_SIMULATION_COUNT,
        );

  const random = mulberry32(params.seed ?? DEFAULT_SIMULATION_SEED);
  const nextNormal = makeNormalSampler(random);

  // Year-major balance buffers (totals across pots): balancesByYear[year][sim]
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

  const startingTotal = potStartBalances.reduce((sum, b) => sum + b, 0);
  const potBalances = new Float64Array(potCount);

  const rule = params.withdrawalRule;
  const minimumWithdrawal = Math.max(0, params.minimumWithdrawal);
  const initialRate = startingTotal > 0 ? annualWithdrawal / startingTotal : 0;
  const withdrawnTotals = new Float64Array(simulationCount);

  for (let sim = 0; sim < simulationCount; sim++) {
    potBalances.set(potStartBalances);
    let total = startingTotal;
    let withdrawal = annualWithdrawal;
    // The plain inflation-grown initial withdrawal, used by floor-ceiling
    let baselineWithdrawal = annualWithdrawal;
    let ratchetStreak = 0;
    let withdrawnSum = 0;
    let depleted = false;
    let simDepletionYear = Infinity;

    balancesByYear[0][sim] = total;

    for (let year = 1; year <= horizonYears; year++) {
      if (!depleted) {
        // Apply the dynamic withdrawal rule before taking this year's
        // withdrawal (from year 2 - year 1 always uses the initial amount)
        if (year > 1 && rule.type !== 'none') {
          const currentRate = withdrawal / total;
          if (rule.type === 'guardrails') {
            if (currentRate > initialRate * (1 + rule.preservationTriggerPct)) {
              withdrawal *= 1 - rule.preservationCutPct;
            } else if (
              currentRate <
              initialRate * (1 - rule.prosperityTriggerPct)
            ) {
              withdrawal *= 1 + rule.prosperityIncreasePct;
            }
          } else if (rule.type === 'ratcheting') {
            if (total > startingTotal * rule.balanceThresholdMultiple) {
              ratchetStreak++;
              if (ratchetStreak >= rule.consecutiveYears) {
                withdrawal *= 1 + rule.ratchetIncreasePct;
                ratchetStreak = 0;
              }
            } else {
              ratchetStreak = 0;
            }
          } else if (rule.type === 'floor-ceiling') {
            withdrawal = clamp(
              initialRate * total,
              baselineWithdrawal * (1 - rule.floorPct),
              baselineWithdrawal * (1 + rule.ceilingPct),
            );
          } else if (rule.type === 'boundaries') {
            if (currentRate > rule.upperRateThreshold) {
              withdrawal *= 1 - rule.upperCutPct;
            } else if (currentRate < rule.lowerRateThreshold) {
              withdrawal *= 1 + rule.lowerIncreasePct;
            }
          }
        }
        if (minimumWithdrawal > 0 && withdrawal < minimumWithdrawal) {
          withdrawal = minimumWithdrawal;
        }

        if (total <= withdrawal) {
          // The pots together can't cover this year's withdrawal; they get
          // whatever was left
          withdrawnSum += total;
          potBalances.fill(0);
          total = 0;
          depleted = true;
          simDepletionYear = year;
          depletionCounts[year]++;
        } else {
          withdrawnSum += withdrawal;
          if (isSequential) {
            let remaining = withdrawal;
            for (let p = 0; p < potCount && remaining > 0; p++) {
              const take = Math.min(potBalances[p], remaining);
              potBalances[p] -= take;
              remaining -= take;
            }
          } else {
            // Proportional split; the last pot takes the remainder so the
            // total drops by exactly the withdrawal (no float drift)
            let remaining = withdrawal;
            for (let p = 0; p < potCount - 1; p++) {
              const take = withdrawal * (potBalances[p] / total);
              potBalances[p] -= take;
              remaining -= take;
            }
            potBalances[potCount - 1] -= remaining;
          }

          // Pick this year's historical year once so all pots experience
          // the same market year (preserves cross-asset correlation)
          let historyIndex = -1;
          if (returnModel === 'historical-bootstrap') {
            historyIndex = Math.floor(random() * historyCount);
          } else if (returnModel === 'historical-sequence') {
            historyIndex = (sim + year - 1) % historyCount;
          }

          // Each pot gets its own return for the year
          total = 0;
          for (let p = 0; p < potCount; p++) {
            if (potBalances[p] > 0) {
              const blended = potHistoricalReturns[p];
              const yearReturn =
                blended && historyIndex >= 0
                  ? blended[historyIndex]
                  : potMeans[p] + potStdDevs[p] * nextNormal();
              potBalances[p] *= 1 + yearReturn;
              if (potBalances[p] <= 0) {
                // A sub-(-100%) return draw wiped this pot out
                potBalances[p] = 0;
              }
            }
            total += potBalances[p];
          }
          if (total <= 0) {
            total = 0;
            depleted = true;
            simDepletionYear = year;
            depletionCounts[year]++;
          }
        }
        if (inflationRate != null) {
          withdrawal *= 1 + inflationRate;
          baselineWithdrawal *= 1 + inflationRate;
        }
      }
      balancesByYear[year][sim] = total;
    }

    withdrawnTotals[sim] = withdrawnSum;

    if (!depleted) {
      survivedCount++;
    }

    if (
      simDepletionYear < worstDepletionYear ||
      (simDepletionYear === worstDepletionYear && total < worstFinalBalance)
    ) {
      worstSimIndex = sim;
      worstDepletionYear = simDepletionYear;
      worstFinalBalance = total;
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
  const withdrawnSorted = withdrawnTotals.slice().sort();

  return {
    successRate: survivedCount / simulationCount,
    percentileBands,
    depletionHistogram,
    depletionProbabilityByYear,
    medianEndingBalance: Math.round(percentileOfSorted(finalSorted, 0.5)),
    medianTotalWithdrawn: Math.round(percentileOfSorted(withdrawnSorted, 0.5)),
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
