import { describe, expect, it } from 'vitest';

import {
  MAX_HORIZON_YEARS,
  MIN_SIMULATION_COUNT,
  runMonteCarloSimulation,
} from './monteCarloSimulation';
import type { MonteCarloParams, MonteCarloPot } from './monteCarloSimulation';

function makePot(overrides: Partial<MonteCarloPot> = {}): MonteCarloPot {
  return {
    id: 'pot-1',
    name: 'Test pot',
    startingBalance: 50_000_000,
    allocationPreset: 'custom',
    expectedReturnMean: 0.06,
    returnStdDev: 0.1,
    ...overrides,
  };
}

function makeParams(
  overrides: Partial<MonteCarloParams> = {},
  potOverrides: Partial<MonteCarloPot> = {},
): MonteCarloParams {
  return {
    pots: [makePot(potOverrides)],
    withdrawalStrategy: 'proportional',
    annualWithdrawal: 2_000_000,
    inflationRate: null,
    horizonYears: 30,
    simulationCount: 1000,
    seed: 42,
    ...overrides,
  };
}

// Independent restatement of the deterministic (zero volatility) recurrence:
// withdrawal at the start of each year, then growth on the remainder.
function deterministicDepletionYear(
  startingBalance: number,
  withdrawal: number,
  annualReturn: number,
  inflationRate: number | null,
  horizonYears: number,
) {
  let balance = startingBalance;
  let currentWithdrawal = withdrawal;
  for (let year = 1; year <= horizonYears; year++) {
    balance -= currentWithdrawal;
    if (balance <= 0) {
      return year;
    }
    balance *= 1 + annualReturn;
    if (inflationRate != null) {
      currentWithdrawal *= 1 + inflationRate;
    }
  }
  return null;
}

describe('runMonteCarloSimulation', () => {
  it('matches the closed-form depletion year with zero volatility', () => {
    const params = makeParams(
      { annualWithdrawal: 10_000, horizonYears: 30 },
      {
        startingBalance: 100_000,
        expectedReturnMean: 0.05,
        returnStdDev: 0,
      },
    );
    const expectedYear = deterministicDepletionYear(
      100_000,
      10_000,
      0.05,
      null,
      30,
    );
    expect(expectedYear).not.toBeNull();

    const result = runMonteCarloSimulation(params);

    expect(result.successRate).toBe(0);
    expect(result.medianDepletionYear).toBe(expectedYear);
    expect(result.earliestDepletionYear).toBe(expectedYear);
    expect(result.latestDepletionYear).toBe(expectedYear);

    const histogramEntry = result.depletionHistogram.find(
      entry => entry.count > 0,
    );
    expect(histogramEntry?.year).toBe(expectedYear);
    expect(histogramEntry?.count).toBe(result.simulationCount);
  });

  it('survives the full horizon when returns outpace withdrawals', () => {
    const result = runMonteCarloSimulation(
      makeParams(
        { annualWithdrawal: 3_000, horizonYears: 30 },
        {
          startingBalance: 100_000,
          expectedReturnMean: 0.05,
          returnStdDev: 0,
        },
      ),
    );

    expect(result.successRate).toBe(1);
    expect(result.medianDepletionYear).toBeNull();
    expect(result.earliestDepletionYear).toBeNull();
    expect(result.depletionHistogram.every(entry => entry.count === 0)).toBe(
      true,
    );
    // Pot should have grown: withdrawals are 3% of a pot earning 5%
    expect(result.medianEndingBalance).toBeGreaterThan(100_000);
  });

  it('always succeeds with no withdrawals', () => {
    const result = runMonteCarloSimulation(
      makeParams({ annualWithdrawal: 0 }, { returnStdDev: 0.2 }),
    );
    expect(result.successRate).toBe(1);
  });

  it('depletes in year one when the withdrawal exceeds the pot', () => {
    const result = runMonteCarloSimulation(
      makeParams({ annualWithdrawal: 20_000 }, { startingBalance: 10_000 }),
    );
    expect(result.successRate).toBe(0);
    expect(result.medianDepletionYear).toBe(1);
    expect(result.depletionHistogram[0]).toEqual({
      year: 1,
      count: result.simulationCount,
    });
  });

  it('grows withdrawals by the inflation rate', () => {
    // pot 200, withdrawal 50, no growth, 100% inflation:
    // y1: 200-50=150 (w -> 100); y2: 150-100=50 (w -> 200); y3: depleted
    const inflated = runMonteCarloSimulation(
      makeParams(
        { annualWithdrawal: 50, inflationRate: 1, horizonYears: 10 },
        {
          startingBalance: 200,
          expectedReturnMean: 0,
          returnStdDev: 0,
        },
      ),
    );
    expect(inflated.medianDepletionYear).toBe(3);

    // Flat withdrawals last one year longer: y4 hits exactly 0
    const flat = runMonteCarloSimulation(
      makeParams(
        { annualWithdrawal: 50, inflationRate: null, horizonYears: 10 },
        {
          startingBalance: 200,
          expectedReturnMean: 0,
          returnStdDev: 0,
        },
      ),
    );
    expect(flat.medianDepletionYear).toBe(4);
  });

  it('is deterministic for a given seed', () => {
    const a = runMonteCarloSimulation(makeParams({ seed: 7 }));
    const b = runMonteCarloSimulation(makeParams({ seed: 7 }));
    expect(a).toEqual(b);

    const c = runMonteCarloSimulation(makeParams({ seed: 8 }));
    expect(c.successRate).not.toBe(a.successRate);
  });

  it('produces ordered percentile bands', () => {
    const result = runMonteCarloSimulation(
      makeParams({}, { returnStdDev: 0.15 }),
    );
    for (const band of result.percentileBands) {
      expect(band.p5).toBeLessThanOrEqual(band.p10);
      expect(band.p10).toBeLessThanOrEqual(band.p25);
      expect(band.p25).toBeLessThanOrEqual(band.p30);
      expect(band.p30).toBeLessThanOrEqual(band.p50);
      expect(band.p50).toBeLessThanOrEqual(band.p70);
      expect(band.p70).toBeLessThanOrEqual(band.p75);
      expect(band.p75).toBeLessThanOrEqual(band.p90);
    }
    expect(result.percentileBands).toHaveLength(result.horizonYears + 1);
    expect(result.percentileBands[0].p10).toBe(50_000_000);
    expect(result.percentileBands[0].p90).toBe(50_000_000);
  });

  it('reports cumulative depletion probability', () => {
    const result = runMonteCarloSimulation(
      makeParams(
        { annualWithdrawal: 2_500_000 },
        { startingBalance: 30_000_000, returnStdDev: 0.15 },
      ),
    );
    const probabilities = result.depletionProbabilityByYear;
    expect(probabilities[0]).toBe(0);
    for (let i = 1; i < probabilities.length; i++) {
      expect(probabilities[i]).toBeGreaterThanOrEqual(probabilities[i - 1]);
    }
    expect(probabilities[result.horizonYears]).toBeCloseTo(
      1 - result.successRate,
      10,
    );
  });

  it('tracks the single worst run', () => {
    const result = runMonteCarloSimulation(
      makeParams(
        { annualWithdrawal: 2_500_000 },
        { startingBalance: 30_000_000, returnStdDev: 0.15 },
      ),
    );
    expect(result.worstRunPath).toHaveLength(result.horizonYears + 1);
    expect(result.worstRunPath[0]).toBe(30_000_000);

    // The worst run is the one that depletes earliest: its path hits zero
    // exactly at the earliest depletion year and stays there
    const firstZeroYear = result.worstRunPath.findIndex(
      balance => balance === 0,
    );
    expect(firstZeroYear).toBe(result.earliestDepletionYear);
    for (let year = firstZeroYear; year < result.worstRunPath.length; year++) {
      expect(result.worstRunPath[year]).toBe(0);
    }
  });

  it('treats two identical half-size pots the same as one pot', () => {
    const singlePot = runMonteCarloSimulation(
      makeParams({}, { startingBalance: 50_000_000, returnStdDev: 0 }),
    );

    for (const strategy of ['proportional', 'sequential'] as const) {
      const twoPots = runMonteCarloSimulation(
        makeParams({
          withdrawalStrategy: strategy,
          pots: [
            makePot({
              id: 'a',
              startingBalance: 25_000_000,
              returnStdDev: 0,
            }),
            makePot({
              id: 'b',
              startingBalance: 25_000_000,
              returnStdDev: 0,
            }),
          ],
        }),
      );

      expect(twoPots.successRate).toBe(singlePot.successRate);
      expect(twoPots.medianEndingBalance).toBe(singlePot.medianEndingBalance);
      expect(twoPots.percentileBands).toEqual(singlePot.percentileBands);
    }
  });

  it('applies the withdrawal strategy across pots', () => {
    // Two pots of 100 each, withdrawal 50/year over 2 years, no volatility.
    // Pot A earns 0%, pot B earns 100%.
    const pots = [
      makePot({
        id: 'a',
        startingBalance: 100,
        expectedReturnMean: 0,
        returnStdDev: 0,
      }),
      makePot({
        id: 'b',
        startingBalance: 100,
        expectedReturnMean: 1,
        returnStdDev: 0,
      }),
    ];

    // Sequential drains pot A first, leaving pot B compounding untouched:
    // y1: A 100-50=50, B 100*2=200; y2: A 0, B 200*2=400 -> total 400
    const sequential = runMonteCarloSimulation(
      makeParams({
        pots,
        withdrawalStrategy: 'sequential',
        annualWithdrawal: 50,
        horizonYears: 2,
      }),
    );
    expect(sequential.medianEndingBalance).toBe(400);

    // Proportional takes some from the growing pot each year:
    // y1: A 75, B 75*2=150 (total 225); y2: factor 1-50/225,
    // A 58.33, B 116.67*2=233.33 -> total ~292
    const proportional = runMonteCarloSimulation(
      makeParams({
        pots,
        withdrawalStrategy: 'proportional',
        annualWithdrawal: 50,
        horizonYears: 2,
      }),
    );
    expect(proportional.medianEndingBalance).toBe(292);

    // Draining the low-return pot first should always come out ahead here
    expect(sequential.medianEndingBalance).toBeGreaterThan(
      proportional.medianEndingBalance,
    );
  });

  it('clamps out-of-range inputs', () => {
    const result = runMonteCarloSimulation(
      makeParams({ simulationCount: 50, horizonYears: 500 }),
    );
    expect(result.simulationCount).toBe(MIN_SIMULATION_COUNT);
    expect(result.horizonYears).toBe(MAX_HORIZON_YEARS);
  });
});
