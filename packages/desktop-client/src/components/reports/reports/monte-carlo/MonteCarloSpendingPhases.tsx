import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDelete } from '@actual-app/components/icons/v0';
import { SvgAdd, SvgQuestion } from '@actual-app/components/icons/v1';
import { Input } from '@actual-app/components/input';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import { v4 as uuidv4 } from 'uuid';

import { MonteCarloNumberInput } from '#components/reports/reports/monte-carlo/MonteCarloNumberInput';
import {
  FIELD_LABEL_ROW_STYLE,
  FIELD_LABEL_STYLE,
  FIELD_STYLE,
} from '#components/reports/reports/monte-carlo/MonteCarloPotConfiguration';
import { createMonteCarloSpendingPhase } from '#components/reports/reports/monte-carlo/monteCarloSimulation';
import type { MonteCarloSpendingPhase } from '#components/reports/reports/monte-carlo/monteCarloSimulation';
import { FinancialInput } from '#components/util/FinancialInput';

function sortPhases(phases: MonteCarloSpendingPhase[]) {
  return [...phases].sort(
    (a, b) => (a.fromAge ?? -Infinity) - (b.fromAge ?? -Infinity),
  );
}

type MonteCarloSpendingPhasesProps = {
  phases: MonteCarloSpendingPhase[];
  currentAge: number;
  targetAge: number;
  onPhasesChange: (phases: MonteCarloSpendingPhase[]) => void;
};

export function MonteCarloSpendingPhases({
  phases,
  currentAge,
  targetAge,
  onPhasesChange,
}: MonteCarloSpendingPhasesProps) {
  const { t } = useTranslation();

  function updatePhase(
    phaseId: string,
    changes: Partial<MonteCarloSpendingPhase>,
  ) {
    onPhasesChange(
      sortPhases(
        phases.map(phase =>
          phase.id === phaseId ? { ...phase, ...changes } : phase,
        ),
      ),
    );
  }

  function removePhase(phaseId: string) {
    const remaining = phases.filter(phase => phase.id !== phaseId);
    // The first phase always starts immediately
    if (remaining.length > 0 && remaining[0].fromAge != null) {
      remaining[0] = { ...remaining[0], fromAge: null };
    }
    onPhasesChange(remaining);
  }

  function addPhase() {
    const lastFrom = phases[phases.length - 1]?.fromAge ?? currentAge;
    const fromAge = Math.max(
      currentAge + 1,
      Math.min(targetAge - 1, lastFrom + 10),
    );
    onPhasesChange(
      sortPhases([...phases, createMonteCarloSpendingPhase(uuidv4(), fromAge)]),
    );
  }

  return (
    <View style={{ gap: 10, marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={FIELD_LABEL_STYLE}>
          <Trans>Spending phases</Trans>
        </Text>
        <Tooltip
          content={
            <View style={{ maxWidth: 300 }}>
              <Text>
                <Trans>
                  Your yearly spending doesn&apos;t have to stay the same for
                  the whole plan. Each phase sets the yearly amount from a given
                  age until the next phase begins &mdash; for example, more in
                  your active early years and less later on.
                  <br />
                  <br />
                  Amounts are in today&apos;s money; the inflation settings on
                  the Plan details tab are applied on top.
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

      {phases.map((phase, index) => {
        const nextPhase = phases[index + 1];
        return (
          <View
            key={phase.id}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              gap: 20,
              padding: 12,
              border: `1px solid ${theme.tableBorder}`,
              borderRadius: 4,
            }}
          >
            <View style={FIELD_STYLE}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Phase name</Trans>
                </Text>
              </View>
              <Input
                // Uncontrolled on purpose: committing on blur keeps typing
                // snappy since every config change re-runs the simulation
                defaultValue={phase.name}
                placeholder={t('Phase {{number}}', { number: index + 1 })}
                onUpdate={newName => {
                  if (newName !== phase.name) {
                    updatePhase(phase.id, { name: newName });
                  }
                }}
              />
            </View>

            <View style={{ width: 120 }}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>From age</Trans>
                </Text>
              </View>
              {index === 0 ? (
                <Text style={{ padding: '6px 0', color: theme.pageText }}>
                  {t('Now ({{age}})', { age: currentAge })}
                </Text>
              ) : (
                <MonteCarloNumberInput
                  value={phase.fromAge}
                  roundToInteger
                  min={currentAge + 1}
                  max={targetAge}
                  step={1}
                  onCommit={newValue =>
                    updatePhase(phase.id, {
                      fromAge: newValue ?? currentAge + 1,
                    })
                  }
                />
              )}
            </View>

            <View style={{ width: 120 }}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Until</Trans>
                </Text>
              </View>
              <Text style={{ padding: '6px 0', color: theme.pageText }}>
                {nextPhase?.fromAge != null
                  ? t('Age {{age}}', { age: nextPhase.fromAge - 1 })
                  : t('Onwards')}
              </Text>
            </View>

            <View style={FIELD_STYLE}>
              <View style={FIELD_LABEL_ROW_STYLE}>
                <Text style={FIELD_LABEL_STYLE}>
                  <Trans>Yearly spending</Trans>
                </Text>
              </View>
              <FinancialInput
                value={phase.annualWithdrawal}
                onUpdate={value =>
                  updatePhase(phase.id, {
                    annualWithdrawal: Math.max(0, value),
                  })
                }
              />
            </View>

            {phases.length > 1 && (
              <Button
                variant="bare"
                aria-label={t('Remove phase')}
                onPress={() => removePhase(phase.id)}
                style={{ padding: 8, marginBottom: 2 }}
              >
                <SvgDelete width={12} height={12} />
              </Button>
            )}
          </View>
        );
      })}

      <View style={{ flexDirection: 'row' }}>
        <Button onPress={addPhase}>
          <SvgAdd width={10} height={10} style={{ marginRight: 5 }} />
          <Trans>Add phase</Trans>
        </Button>
      </View>
    </View>
  );
}
