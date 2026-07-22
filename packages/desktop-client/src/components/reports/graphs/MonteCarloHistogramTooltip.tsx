import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';

type PayloadItem = {
  payload: {
    year: number;
    count: number;
  };
};

type MonteCarloHistogramTooltipProps = {
  active?: boolean;
  payload?: PayloadItem[];
  simulationCount: number;
};

export function MonteCarloHistogramTooltip({
  active,
  payload,
  simulationCount,
}: MonteCarloHistogramTooltipProps) {
  const { t } = useTranslation();

  if (active && payload && payload.length) {
    const point = payload[0].payload;
    return (
      <div
        className={css({
          zIndex: 1000,
          pointerEvents: 'none',
          borderRadius: 2,
          boxShadow: '0 1px 6px rgba(0, 0, 0, .20)',
          backgroundColor: theme.menuBackground,
          color: theme.menuItemText,
          padding: 10,
        })}
      >
        {t(
          '{{count}} of {{total}} scenarios ran out of money in year {{year}}',
          {
            count: point.count,
            total: simulationCount,
            year: point.year,
          },
        )}
      </div>
    );
  }
  return null;
}
