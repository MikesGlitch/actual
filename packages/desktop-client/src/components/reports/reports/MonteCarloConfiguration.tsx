import type { DragItem } from 'react-aria';
import { DropIndicator, GridList, useDragAndDrop } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgAdd, SvgQuestion } from '@actual-app/components/icons/v1';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import type { MonteCarloWithdrawalStrategy } from '@actual-app/core/types/models';
import { css } from '@emotion/css';
import { v4 as uuidv4 } from 'uuid';

import { MonteCarloNumberInput } from '#components/reports/reports/MonteCarloNumberInput';
import {
  FIELD_LABEL_ROW_STYLE,
  FIELD_LABEL_STYLE,
  FIELD_STYLE,
  MonteCarloPotConfiguration,
} from '#components/reports/reports/MonteCarloPotConfiguration';
import {
  createMonteCarloPot,
  MAX_HORIZON_YEARS,
  MAX_SIMULATION_COUNT,
  MIN_HORIZON_YEARS,
  MIN_SIMULATION_COUNT,
} from '#components/reports/reports/monteCarloSimulation';
import type {
  MonteCarloConfig,
  MonteCarloPot,
} from '#components/reports/reports/monteCarloSimulation';
import { FinancialInput } from '#components/util/FinancialInput';

const SECTION_TITLE_STYLE = {
  fontWeight: 600,
  marginBottom: 10,
  color: theme.pageText,
  textTransform: 'uppercase',
  fontSize: 12,
  letterSpacing: 0.5,
} as const;

type MonteCarloConfigurationProps = {
  config: MonteCarloConfig;
  onConfigChange: (changes: Partial<MonteCarloConfig>) => void;
};

export function MonteCarloConfiguration({
  config,
  onConfigChange,
}: MonteCarloConfigurationProps) {
  const { t } = useTranslation();

  function onPotChange(potId: string, changes: Partial<MonteCarloPot>) {
    onConfigChange({
      pots: config.pots.map(pot =>
        pot.id === potId ? { ...pot, ...changes } : pot,
      ),
    });
  }

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys =>
      [...keys].map(key => ({ 'text/plain': String(key) }) as DragItem),
    renderDropIndicator: target => (
      <DropIndicator
        target={target}
        className={css({
          '&[data-drop-target]': {
            height: 4,
            backgroundColor: theme.tableBorderSeparator,
            opacity: 1,
            borderRadius: 4,
          },
        })}
      />
    ),
    onReorder: e => {
      const [movedKey] = e.keys;
      const fromIndex = config.pots.findIndex(pot => pot.id === movedKey);
      const targetIndex = config.pots.findIndex(pot => pot.id === e.target.key);
      if (fromIndex === -1 || targetIndex === -1) {
        return;
      }

      const newPots = [...config.pots];
      const [movedPot] = newPots.splice(fromIndex, 1);
      let insertIndex =
        targetIndex + (e.target.dropPosition === 'after' ? 1 : 0);
      if (fromIndex < insertIndex) {
        insertIndex -= 1;
      }
      newPots.splice(insertIndex, 0, movedPot);
      onConfigChange({ pots: newPots });
    },
  });

  return (
    <View
      style={{
        backgroundColor: theme.tableBackground,
        padding: 20,
        flexShrink: 0,
        gap: 25,
      }}
    >
      {/* Investment pots. Future settings like withdrawal rules or fees
          belong in their own section alongside these. */}
      <View>
        <Text style={SECTION_TITLE_STYLE}>
          <Trans>Investment pots</Trans>
        </Text>
        <View>
          <GridList
            aria-label={t('Investment pots')}
            // Without this, typing in the pot fields moves the list
            // highlight to whichever pot name matches the keystroke
            disallowTypeAhead
            items={config.pots}
            dependencies={[config, onConfigChange]}
            dragAndDropHooks={dragAndDropHooks}
          >
            {pot => (
              <MonteCarloPotConfiguration
                key={pot.id}
                pot={pot}
                potNumber={config.pots.indexOf(pot) + 1}
                canRemove={config.pots.length > 1}
                onPotChange={changes => onPotChange(pot.id, changes)}
                onRemove={() =>
                  onConfigChange({
                    pots: config.pots.filter(other => other.id !== pot.id),
                  })
                }
              />
            )}
          </GridList>
          <View style={{ flexDirection: 'row' }}>
            <Button
              onPress={() =>
                onConfigChange({
                  pots: [...config.pots, createMonteCarloPot(uuidv4())],
                })
              }
            >
              <SvgAdd width={10} height={10} style={{ marginRight: 5 }} />
              <Trans>Add pot</Trans>
            </Button>
          </View>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 40,
          rowGap: 25,
        }}
      >
        {/* Withdrawals */}
        <View>
          <Text style={SECTION_TITLE_STYLE}>
            <Trans>Withdrawals</Trans>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
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
                          How much you take out of your pots each year to live
                          on. This is what depletes them over time.
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

            <View style={{ width: 220 }}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Withdrawal order</Trans>
                </Text>
                <Tooltip
                  content={
                    <View style={{ maxWidth: 300 }}>
                      <Text>
                        <Trans>
                          How the annual withdrawal is taken when you have more
                          than one pot.
                          <br />
                          <br />
                          Proportionally: split across pots based on their
                          current balances.
                          <br />
                          <br />
                          In pot order: drain the first pot before touching the
                          next, in the order listed above.
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
                value={config.withdrawalStrategy}
                onChange={value =>
                  onConfigChange({
                    withdrawalStrategy: value as MonteCarloWithdrawalStrategy,
                  })
                }
                options={[
                  ['proportional', t('Split proportionally across pots')],
                  ['sequential', t('Drain pots in order')],
                ]}
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
              <MonteCarloNumberInput
                value={config.inflationRate}
                scale={100}
                allowEmpty
                min={0}
                max={100}
                placeholder={t('None')}
                onCommit={newValue =>
                  onConfigChange({ inflationRate: newValue })
                }
              />
            </View>

            <View style={FIELD_STYLE}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Time horizon (years)</Trans>
                </Text>
              </View>
              <MonteCarloNumberInput
                value={config.horizonYears}
                roundToInteger
                min={MIN_HORIZON_YEARS}
                max={MAX_HORIZON_YEARS}
                step={1}
                onCommit={newValue =>
                  onConfigChange({
                    horizonYears: newValue ?? MIN_HORIZON_YEARS,
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
              <MonteCarloNumberInput
                value={config.simulationCount}
                roundToInteger
                min={MIN_SIMULATION_COUNT}
                max={MAX_SIMULATION_COUNT}
                step={500}
                onCommit={newValue =>
                  onConfigChange({
                    simulationCount: newValue ?? MIN_SIMULATION_COUNT,
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
