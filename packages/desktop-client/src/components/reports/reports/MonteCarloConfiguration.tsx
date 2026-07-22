import { Trans, useTranslation } from 'react-i18next';

import { SvgQuestion } from '@actual-app/components/icons/v1';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import type { MonteCarloAllocationPreset } from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import {
  ALLOCATION_PRESETS,
  MAX_HORIZON_YEARS,
  MAX_SIMULATION_COUNT,
  MIN_HORIZON_YEARS,
  MIN_SIMULATION_COUNT,
  MONTE_CARLO_DEFAULTS,
} from '#components/reports/reports/monteCarloSimulation';
import type { MonteCarloConfig } from '#components/reports/reports/monteCarloSimulation';
import { FinancialInput } from '#components/util/FinancialInput';

const SECTION_TITLE_STYLE = {
  fontWeight: 600,
  marginBottom: 10,
  color: theme.pageText,
  textTransform: 'uppercase',
  fontSize: 12,
  letterSpacing: 0.5,
} as const;

const FIELD_LABEL_STYLE = { fontWeight: 600 } as const;

const FIELD_STYLE = { width: 170 } as const;

const FIELD_LABEL_ROW_STYLE = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 6,
  minHeight: 18,
} as const;

// Plain numeric text input - no browser spin buttons
const NUMBER_INPUT_CLASS = css({
  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
    WebkitAppearance: 'none',
    margin: 0,
  },
  MozAppearance: 'textfield',
});

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type MonteCarloConfigurationProps = {
  config: MonteCarloConfig;
  onConfigChange: (changes: Partial<MonteCarloConfig>) => void;
};

export function MonteCarloConfiguration({
  config,
  onConfigChange,
}: MonteCarloConfigurationProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        backgroundColor: theme.tableBackground,
        padding: 20,
        flexShrink: 0,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 40,
          rowGap: 25,
        }}
      >
        {/* Pot & withdrawals. Future settings like withdrawal rules belong
            in their own section alongside these. */}
        <View>
          <Text style={SECTION_TITLE_STYLE}>
            <Trans>Pot & withdrawals</Trans>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
            <View style={FIELD_STYLE}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Starting pot</Trans>
                </Text>
              </View>
              <FinancialInput
                value={config.startingBalance}
                onUpdate={value =>
                  onConfigChange({ startingBalance: Math.max(0, value) })
                }
              />
            </View>

            <View style={FIELD_STYLE}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Annual withdrawal</Trans>
                </Text>
                <Tooltip
                  content={
                    <View style={{ maxWidth: 300 }}>
                      <Text>
                        <Trans>
                          How much you take out of the pot each year to live on.
                          This is what depletes the pot over time.
                        </Trans>
                      </Text>
                    </View>
                  }
                  placement="bottom start"
                  style={{ ...styles.tooltip }}
                >
                  <SvgQuestion height={12} width={12} cursor="pointer" />
                </Tooltip>
              </View>
              <FinancialInput
                value={config.annualWithdrawal}
                onUpdate={value =>
                  onConfigChange({ annualWithdrawal: Math.max(0, value) })
                }
              />
            </View>

            <View style={FIELD_STYLE}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Inflation rate (%)</Trans>
                </Text>
                <Tooltip
                  content={
                    <View style={{ maxWidth: 300 }}>
                      <Text>
                        <Trans>
                          When set, your withdrawal grows by this rate each year
                          so your spending power is maintained.
                          <br />
                          <br />
                          Leave blank to keep withdrawals flat.
                        </Trans>
                      </Text>
                    </View>
                  }
                  placement="bottom start"
                  style={{ ...styles.tooltip }}
                >
                  <SvgQuestion height={12} width={12} cursor="pointer" />
                </Tooltip>
              </View>
              <Input
                type="number"
                className={NUMBER_INPUT_CLASS}
                min={0}
                max={100}
                step={0.1}
                value={
                  config.inflationRate == null
                    ? ''
                    : Number((config.inflationRate * 100).toFixed(2))
                }
                onChange={e =>
                  onConfigChange({
                    inflationRate: isNaN(e.target.valueAsNumber)
                      ? null
                      : e.target.valueAsNumber / 100,
                  })
                }
                placeholder={t('None')}
              />
            </View>

            <View style={FIELD_STYLE}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Time horizon (years)</Trans>
                </Text>
              </View>
              <Input
                type="number"
                className={NUMBER_INPUT_CLASS}
                min={MIN_HORIZON_YEARS}
                max={MAX_HORIZON_YEARS}
                step={1}
                value={config.horizonYears}
                onChange={e =>
                  onConfigChange({
                    horizonYears: isNaN(e.target.valueAsNumber)
                      ? MONTE_CARLO_DEFAULTS.horizonYears
                      : e.target.valueAsNumber,
                  })
                }
                onBlur={() =>
                  onConfigChange({
                    horizonYears: clampValue(
                      Math.round(config.horizonYears),
                      MIN_HORIZON_YEARS,
                      MAX_HORIZON_YEARS,
                    ),
                  })
                }
              />
            </View>
          </View>
        </View>

        {/* Market assumptions */}
        <View>
          <Text style={SECTION_TITLE_STYLE}>
            <Trans>Market assumptions</Trans>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
            <View style={{ width: 220 }}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Portfolio allocation</Trans>
                </Text>
                <Tooltip
                  content={
                    <View style={{ maxWidth: 300 }}>
                      <Text>
                        <Trans>
                          A one-click starting point that fills in a typical
                          expected return and volatility for the selected mix of
                          stocks and bonds. You can still override both values.
                        </Trans>
                      </Text>
                    </View>
                  }
                  placement="bottom start"
                  style={{ ...styles.tooltip }}
                >
                  <SvgQuestion height={12} width={12} cursor="pointer" />
                </Tooltip>
              </View>
              <Select
                value={config.allocationPreset}
                onChange={value => {
                  const preset = value as MonteCarloAllocationPreset;
                  if (preset === 'custom') {
                    onConfigChange({ allocationPreset: preset });
                  } else {
                    onConfigChange({
                      allocationPreset: preset,
                      expectedReturnMean: ALLOCATION_PRESETS[preset].mean,
                      returnStdDev: ALLOCATION_PRESETS[preset].stdDev,
                    });
                  }
                }}
                options={[
                  ['equity-100', t('100% stocks')],
                  ['equity-80', t('80% stocks / 20% bonds')],
                  ['equity-60', t('60% stocks / 40% bonds')],
                  ['equity-40', t('40% stocks / 60% bonds')],
                  ['cash', t('Cash / money market')],
                  ['custom', t('Custom')],
                ]}
              />
            </View>

            <View style={FIELD_STYLE}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Expected return (%)</Trans>
                </Text>
                <Tooltip
                  content={
                    <View style={{ maxWidth: 300 }}>
                      <Text>
                        <Trans>
                          The average yearly investment return before inflation.
                          Each simulated year draws a random return around this
                          average.
                        </Trans>
                      </Text>
                    </View>
                  }
                  placement="bottom start"
                  style={{ ...styles.tooltip }}
                >
                  <SvgQuestion height={12} width={12} cursor="pointer" />
                </Tooltip>
              </View>
              <Input
                type="number"
                className={NUMBER_INPUT_CLASS}
                min={-100}
                max={100}
                step={0.1}
                value={Number((config.expectedReturnMean * 100).toFixed(2))}
                onChange={e =>
                  onConfigChange({
                    expectedReturnMean: isNaN(e.target.valueAsNumber)
                      ? 0
                      : e.target.valueAsNumber / 100,
                    allocationPreset: 'custom',
                  })
                }
              />
            </View>

            <View style={FIELD_STYLE}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Volatility (std dev %)</Trans>
                </Text>
                <Tooltip
                  content={
                    <View style={{ maxWidth: 300 }}>
                      <Text>
                        <Trans>
                          How much returns swing from year to year. Higher
                          volatility means bigger ups and downs, which makes
                          running out of money more likely even with the same
                          average return.
                        </Trans>
                      </Text>
                    </View>
                  }
                  placement="bottom start"
                  style={{ ...styles.tooltip }}
                >
                  <SvgQuestion height={12} width={12} cursor="pointer" />
                </Tooltip>
              </View>
              <Input
                type="number"
                className={NUMBER_INPUT_CLASS}
                min={0}
                max={100}
                step={0.1}
                value={Number((config.returnStdDev * 100).toFixed(2))}
                onChange={e =>
                  onConfigChange({
                    returnStdDev: isNaN(e.target.valueAsNumber)
                      ? 0
                      : Math.max(0, e.target.valueAsNumber / 100),
                    allocationPreset: 'custom',
                  })
                }
              />
            </View>
          </View>
        </View>

        {/* Simulation */}
        <View>
          <Text style={SECTION_TITLE_STYLE}>
            <Trans>Simulation</Trans>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
            <View style={FIELD_STYLE}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Simulations</Trans>
                </Text>
                <Tooltip
                  content={
                    <View style={{ maxWidth: 300 }}>
                      <Text>
                        <Trans>
                          How many random scenarios to run. More simulations
                          give a steadier result but take slightly longer.
                        </Trans>
                      </Text>
                    </View>
                  }
                  placement="bottom start"
                  style={{ ...styles.tooltip }}
                >
                  <SvgQuestion height={12} width={12} cursor="pointer" />
                </Tooltip>
              </View>
              <Input
                type="number"
                className={NUMBER_INPUT_CLASS}
                min={MIN_SIMULATION_COUNT}
                max={MAX_SIMULATION_COUNT}
                step={500}
                value={config.simulationCount}
                onChange={e =>
                  onConfigChange({
                    simulationCount: isNaN(e.target.valueAsNumber)
                      ? MONTE_CARLO_DEFAULTS.simulationCount
                      : e.target.valueAsNumber,
                  })
                }
                onBlur={() =>
                  onConfigChange({
                    simulationCount: clampValue(
                      Math.round(config.simulationCount),
                      MIN_SIMULATION_COUNT,
                      MAX_SIMULATION_COUNT,
                    ),
                  })
                }
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
