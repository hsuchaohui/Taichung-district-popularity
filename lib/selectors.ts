import type { DemoDataset, MonthlyMetric } from './types';

export function getMonthRanking(data: DemoDataset, month: string): MonthlyMetric[] {
  return data.monthlyMetrics
    .filter(row => row.month === month)
    .sort((left, right) => {
      if (left.rank === null) return right.rank === null ? 0 : 1;
      if (right.rank === null) return -1;
      return left.rank - right.rank;
    });
}

export function getDistrictSeries(data: DemoDataset, districtId: string): MonthlyMetric[] {
  return data.monthlyMetrics
    .filter(row => row.districtId === districtId)
    .sort((left, right) => left.month.localeCompare(right.month));
}

export function getComparisonRows(
  data: DemoDataset,
  districtIds: string[],
): MonthlyMetric[] {
  const uniqueIds = new Set(districtIds);

  if (districtIds.length < 2 || districtIds.length > 4) {
    throw new Error('Comparison requires 2–4 district IDs');
  }
  if (uniqueIds.size !== districtIds.length) {
    throw new Error('Comparison district IDs must be unique');
  }

  return data.monthlyMetrics.filter(row => uniqueIds.has(row.districtId));
}

export function formatMetric(value: number | null, unit: string): string {
  return value === null ? '本月資料尚未提供' : `${value} ${unit}`;
}

export function getAvailableMonths(data: DemoDataset): string[] {
  return [...new Set(data.monthlyMetrics.map(row => row.month))].sort();
}
