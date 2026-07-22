import type { ComponentPropsWithoutRef } from 'react';
import { GridListItem } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDelete } from '@actual-app/components/icons/v0';
import {
  SvgDotsHorizontalDouble,
  SvgQuestion,
} from '@actual-app/components/icons/v1';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import type { MonteCarloAllocationPreset } from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import { MonteCarloNumberInput } from '#components/reports/reports/MonteCarloNumberInput';
import { ALLOCATION_PRESETS } from '#components/reports/reports/monteCarloSimulation';
import type { MonteCarloPot } from '#components/reports/reports/monteCarloSimulation';
import { FinancialInput } from '#components/util/FinancialInput';

export const FIELD_LABEL_STYLE = { fontWeight: 600 } as const;

export const FIELD_STYLE = { width: 170 } as const;

export const FIELD_LABEL_ROW_STYLE = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 6,
  minHeight: 18,
} as const;

type MonteCarloPotConfigurationProps = ComponentPropsWithoutRef<
  typeof GridListItem<MonteCarloPot>
> & {
  pot: MonteCarloPot;
  potNumber: number;
  canRemove: boolean;
  onPotChange: (changes: Partial<MonteCarloPot>) => void;
  onRemove: () => void;
};

export function MonteCarloPotConfiguration({
  pot,
  potNumber,
  canRemove,
  onPotChange,
  onRemove,
  ...props
}: MonteCarloPotConfigurationProps) {
  const { t } = useTranslation();

  return (
    <GridListItem
      textValue={pot.name || t('Pot {{number}}', { number: potNumber })}
      className={css({
        marginBottom: 10,
        borderRadius: 4,
        '&[data-dragging]': {
          opacity: 0.5,
        },
      })}
      {...props}
    >
      <View
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
        <Button
          slot="drag"
          variant="bare"
          aria-label={t('Drag to reorder')}
          style={{
            padding: 8,
            marginBottom: 2,
            cursor: 'grab',
            color: theme.pageTextSubdued,
          }}
        >
          <SvgDotsHorizontalDouble
            width={14}
            height={14}
            style={{ transform: 'rotate(90deg)' }}
          />
        </Button>
        <View style={FIELD_STYLE}>
          <View style={FIELD_LABEL_ROW_STYLE}>
            <Text style={FIELD_LABEL_STYLE}>
              <Trans>Pot name</Trans>
            </Text>
          </View>
          <Input
            // Uncontrolled on purpose: committing on blur keeps typing
            // snappy since every config change re-runs the simulation
            defaultValue={pot.name}
            placeholder={t('Pot {{number}}', { number: potNumber })}
            onUpdate={newName => {
              if (newName !== pot.name) {
                onPotChange({ name: newName });
              }
            }}
          />
        </View>

        <View style={FIELD_STYLE}>
          <View style={FIELD_LABEL_ROW_STYLE}>
            <Text style={FIELD_LABEL_STYLE}>
              <Trans>Starting balance</Trans>
            </Text>
          </View>
          <FinancialInput
            value={pot.startingBalance}
            onUpdate={value =>
              onPotChange({ startingBalance: Math.max(0, value) })
            }
          />
        </View>

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
            value={pot.allocationPreset}
            onChange={value => {
              const preset = value as MonteCarloAllocationPreset;
              if (preset === 'custom') {
                onPotChange({ allocationPreset: preset });
              } else {
                onPotChange({
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
          <MonteCarloNumberInput
            value={pot.expectedReturnMean}
            scale={100}
            min={-100}
            max={100}
            onCommit={newValue =>
              onPotChange({
                expectedReturnMean: newValue ?? 0,
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
                      volatility means bigger ups and downs, which makes running
                      out of money more likely even with the same average
                      return.
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
            value={pot.returnStdDev}
            scale={100}
            min={0}
            max={100}
            onCommit={newValue =>
              onPotChange({
                returnStdDev: newValue ?? 0,
                allocationPreset: 'custom',
              })
            }
          />
        </View>

        {canRemove && (
          <Button
            variant="bare"
            aria-label={t('Remove pot')}
            onPress={onRemove}
            style={{ padding: 8, marginBottom: 2 }}
          >
            <SvgDelete width={12} height={12} />
          </Button>
        )}
      </View>
    </GridListItem>
  );
}
