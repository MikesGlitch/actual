import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Paragraph } from '@actual-app/components/paragraph';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { MonteCarloWidget } from '@actual-app/core/types/models';

import { EditablePageHeaderTitle } from '#components/EditablePageHeaderTitle';
import { FinancialText } from '#components/FinancialText';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { MobilePageHeader, Page, PageHeader } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { MonteCarloGraph } from '#components/reports/graphs/MonteCarloGraph';
import type { MonteCarloGraphView } from '#components/reports/graphs/MonteCarloGraphTooltip';
import { MonteCarloHistogram } from '#components/reports/graphs/MonteCarloHistogram';
import { LoadingIndicator } from '#components/reports/LoadingIndicator';
import { MonteCarloConfiguration } from '#components/reports/reports/MonteCarloConfiguration';
import {
  MONTE_CARLO_DEFAULTS,
  monteCarloConfigFromMeta,
  runMonteCarloSimulation,
} from '#components/reports/reports/monteCarloSimulation';
import type { MonteCarloConfig } from '#components/reports/reports/monteCarloSimulation';
import { useDashboardWidget } from '#hooks/useDashboardWidget';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { useUpdateDashboardWidgetMutation } from '#reports/mutations';

const STAT_HEADING_STYLE = {
  fontWeight: 600,
  color: theme.pageText,
  textTransform: 'uppercase',
  fontSize: 12,
  letterSpacing: 0.5,
} as const;

export function MonteCarlo() {
  const params = useParams();
  const { data: widget, isLoading } = useDashboardWidget<MonteCarloWidget>({
    id: params.id,
    type: 'monte-carlo-card',
  });

  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const navigate = useNavigate();
  const { isNarrowWidth } = useResponsive();

  const [config, setConfig] = useState<MonteCarloConfig>(MONTE_CARLO_DEFAULTS);
  const [graphView, setGraphView] = useState<MonteCarloGraphView>('all');
  const [selectionsInitialized, setSelectionsInitialized] = useState(false);

  // reset when widget changes
  useEffect(() => {
    setSelectionsInitialized(false);
  }, [widget?.id]);

  // initialize once when the widget (if any) is available
  useEffect(() => {
    if (selectionsInitialized || isLoading) {
      return;
    }

    setConfig(monteCarloConfigFromMeta(widget?.meta));
    setSelectionsInitialized(true);
  }, [selectionsInitialized, isLoading, widget?.meta]);

  const updateDashboardWidgetMutation = useUpdateDashboardWidgetMutation();

  async function onSaveWidget() {
    if (!widget) {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Save failed: No widget found to save.'),
          },
        }),
      );
      return;
    }

    updateDashboardWidgetMutation.mutate(
      {
        widget: {
          id: widget.id,
          meta: {
            ...(widget.meta ?? {}),
            ...config,
          },
        },
      },
      {
        onSuccess: () => {
          dispatch(
            addNotification({
              notification: {
                type: 'message',
                message: t('Dashboard widget successfully saved.'),
              },
            }),
          );
        },
      },
    );
  }

  const title = widget?.meta?.name || t('Monte Carlo Analysis');
  const onSaveWidgetName = async (newName: string) => {
    if (!widget) {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Save failed: No widget found to save.'),
          },
        }),
      );
      return;
    }

    const name = newName || t('Monte Carlo Analysis');
    updateDashboardWidgetMutation.mutate({
      widget: {
        id: widget.id,
        meta: {
          ...(widget.meta ?? {}),
          name,
        },
      },
    });
  };

  if (isLoading || !selectionsInitialized) {
    return <LoadingIndicator />;
  }

  const result = runMonteCarloSimulation(config);

  const successPercent = Math.round(result.successRate * 1000) / 10;
  const depletionPercent = Math.round((1 - result.successRate) * 1000) / 10;
  const failedCount = result.depletionHistogram.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  const hasFailures = failedCount > 0;
  const successColor =
    result.successRate >= 0.75
      ? theme.reportsNumberPositive
      : result.successRate >= 0.5
        ? theme.warningText
        : theme.reportsNumberNegative;

  return (
    <Page
      header={
        isNarrowWidth ? (
          <MobilePageHeader
            title={title}
            leftContent={
              <MobileBackButton onPress={() => navigate('/reports')} />
            }
          />
        ) : (
          <PageHeader
            title={
              widget ? (
                <EditablePageHeaderTitle
                  title={title}
                  onSave={onSaveWidgetName}
                />
              ) : (
                title
              )
            }
          />
        )
      }
      padding={0}
    >
      <View
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingLeft: !isNarrowWidth ? 20 : 10,
          paddingRight: !isNarrowWidth ? 20 : 10,
          paddingBottom: 20,
          gap: 10,
        }}
      >
        {/* Configuration */}
        <View style={{ flexShrink: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 0',
              flexShrink: 0,
            }}
          >
            <Text
              style={{
                ...styles.mediumText,
                fontWeight: 600,
              }}
            >
              <Trans>Configuration</Trans>
            </Text>
            {widget && (
              <Button variant="primary" onPress={onSaveWidget}>
                <Trans>Save widget</Trans>
              </Button>
            )}
          </View>
          <MonteCarloConfiguration
            config={config}
            onConfigChange={changes =>
              setConfig(prev => ({ ...prev, ...changes }))
            }
          />
        </View>

        {/* Results */}
        <Text
          style={{
            ...styles.mediumText,
            fontWeight: 600,
            padding: '10px 0',
            flexShrink: 0,
          }}
        >
          <Trans>Results</Trans>
        </Text>

        {/* Headline stats */}
        <View
          style={{
            backgroundColor: theme.tableBackground,
            padding: 20,
            flexShrink: 0,
            gap: 15,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 40,
              rowGap: 20,
              alignItems: 'flex-start',
            }}
          >
            <View style={{ gap: 4 }}>
              <Text style={STAT_HEADING_STYLE}>
                <Trans>Success rate</Trans>
              </Text>
              <Text
                style={{
                  ...styles.veryLargeText,
                  color: successColor,
                }}
              >
                <FinancialText as="span">{`${successPercent}%`}</FinancialText>
              </Text>
            </View>
            <View style={{ gap: 4 }}>
              <Text style={STAT_HEADING_STYLE}>
                <Trans>Median ending balance</Trans>
              </Text>
              <Text style={{ ...styles.mediumText, fontWeight: 500 }}>
                <PrivacyFilter>
                  <FinancialText as="span">
                    {format(result.medianEndingBalance, 'financial')}
                  </FinancialText>
                </PrivacyFilter>
              </Text>
            </View>
            <View style={{ gap: 4 }}>
              <Text style={STAT_HEADING_STYLE}>
                <Trans>Chance of running out of money</Trans>
              </Text>
              <Text style={{ ...styles.mediumText, fontWeight: 500 }}>
                <FinancialText as="span">{`${depletionPercent}%`}</FinancialText>
              </Text>
            </View>
            {result.medianDepletionYear != null && (
              <View style={{ gap: 4 }}>
                <Text style={STAT_HEADING_STYLE}>
                  <Trans>Typical failure runs out in</Trans>
                </Text>
                <Text style={{ ...styles.mediumText, fontWeight: 500 }}>
                  {t('Year {{year}}', { year: result.medianDepletionYear })}
                </Text>
              </View>
            )}
          </View>
          <View style={{ marginTop: 10, gap: 5 }}>
            <Text style={STAT_HEADING_STYLE}>
              <Trans>Summary</Trans>
            </Text>
            <Text>
              {t(
                'In {{successPercent}}% of {{simulationCount}} simulated scenarios, your pot lasted the full {{horizonYears}} years.',
                {
                  successPercent,
                  simulationCount: result.simulationCount,
                  horizonYears: result.horizonYears,
                },
              )}
            </Text>
          </View>
        </View>

        {/* Portfolio performance chart */}
        <View
          style={{
            backgroundColor: theme.tableBackground,
            padding: 20,
            paddingBottom: 10,
            height: 470,
            flexShrink: 0,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 10,
              flexShrink: 0,
            }}
          >
            <Text style={{ ...styles.mediumText, fontWeight: 600 }}>
              <Trans>Portfolio performance</Trans>
            </Text>
            <Select
              value={graphView}
              onChange={value => setGraphView(value as MonteCarloGraphView)}
              options={[
                ['all', t('All scenarios')],
                ['single-worst', t('Single worst run')],
                ['worst-case', t('Worst-case scenario (5th percentile)')],
                ['pessimistic', t('Pessimistic scenario (30th percentile)')],
                ['median', t('Median scenario (50th percentile)')],
                ['optimistic', t('Optimistic scenario (70th percentile)')],
              ]}
              style={{ width: 280 }}
            />
          </View>
          {graphView !== 'all' && (
            <Text
              style={{
                color: theme.pageTextSubdued,
                marginBottom: 10,
                flexShrink: 0,
              }}
            >
              {graphView === 'single-worst'
                ? t(
                    'The unluckiest of all {{simulationCount}} simulated runs - the one that ran out of money earliest.',
                    { simulationCount: result.simulationCount },
                  )
                : graphView === 'worst-case'
                  ? t('95% of scenarios stayed above this line.')
                  : graphView === 'pessimistic'
                    ? t('70% of scenarios stayed above this line.')
                    : graphView === 'median'
                      ? t('Half of scenarios stayed above this line.')
                      : t('30% of scenarios stayed above this line.')}
            </Text>
          )}
          <MonteCarloGraph
            percentileBands={result.percentileBands}
            worstRunPath={result.worstRunPath}
            view={graphView}
            style={{ height: '100%', flex: 1 }}
          />
        </View>

        {/* Depletion histogram */}
        <View
          style={{
            backgroundColor: theme.tableBackground,
            padding: 20,
            flexShrink: 0,
          }}
        >
          <Text
            style={{
              ...styles.mediumText,
              fontWeight: 600,
              marginBottom: 5,
            }}
          >
            <Trans>When did the pot run out?</Trans>
          </Text>
          {hasFailures ? (
            <>
              <Text style={{ color: theme.pageTextSubdued, marginBottom: 10 }}>
                {t(
                  'Only the {{failedCount}} of {{simulationCount}} scenarios that ran out of money are shown here - the other {{survivedCount}} kept a positive balance for the full horizon.',
                  {
                    failedCount,
                    simulationCount: result.simulationCount,
                    survivedCount: result.simulationCount - failedCount,
                  },
                )}
              </Text>
              <View style={{ height: 200, flexShrink: 0 }}>
                <MonteCarloHistogram
                  depletionHistogram={result.depletionHistogram}
                  medianDepletionYear={result.medianDepletionYear}
                  simulationCount={result.simulationCount}
                  style={{ height: 200 }}
                />
              </View>
              <View style={{ marginTop: 10, flexShrink: 0 }}>
                <Text style={{ color: theme.pageTextSubdued }}>
                  {t(
                    'Worst case: money ran out in year {{worst}}. Among failures, the typical depletion year was {{median}}; the luckiest failure lasted until year {{best}}.',
                    {
                      worst: result.earliestDepletionYear,
                      median: result.medianDepletionYear,
                      best: result.latestDepletionYear,
                    },
                  )}
                </Text>
              </View>
            </>
          ) : (
            <Paragraph>
              <Trans>
                The pot survived the full time horizon in every simulated
                scenario.
              </Trans>
            </Paragraph>
          )}
        </View>

        {/* Description */}
        <View
          style={{
            backgroundColor: theme.tableBackground,
            padding: 20,
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <Text
            style={{
              ...styles.mediumText,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            <Trans>How does this simulation work?</Trans>
          </Text>
          <Paragraph>
            <Trans>
              Each scenario replays your retirement with a different random
              sequence of yearly investment returns, drawn around your expected
              return and volatility. Every year the withdrawal is taken first,
              then the remaining pot grows or shrinks with that year&apos;s
              return. The shaded bands show the range of outcomes across all
              scenarios: the darker band covers the middle half, and the lighter
              band covers 80% of them.
            </Trans>
          </Paragraph>
          <Paragraph>
            <Trans>
              Keep in mind this is a simplified model: returns are drawn
              independently each year from a normal distribution, which ignores
              sequence-of-returns clustering, fat tails, fees, and taxes. Treat
              the results as a rough guide, not a guarantee.
            </Trans>
          </Paragraph>
        </View>
      </View>
    </Page>
  );
}
