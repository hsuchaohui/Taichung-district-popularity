import { describe, expect, it } from 'vitest';
import {
  formatMetric,
  getAvailableMonths,
  getComparisonRows,
  getDistrictSeries,
  getMonthRanking,
} from '../lib/selectors';
import type { DemoDataset, MonthlyMetric } from '../lib/types';

function metric(districtId: string, month: string, rank: number | null = null): MonthlyMetric {
  return Object.freeze({
    districtId,
    month,
    visitors: null,
    stayMinutes: null,
    revisitRate: null,
    attractionScore: null,
    engagementScore: null,
    loyaltyScore: null,
    popularityScore: null,
    rank,
    rankChange: null,
    dataStatus: 'demo',
  });
}

function dataset(...monthlyMetrics: MonthlyMetric[]): DemoDataset {
  return Object.freeze({
    metadata: Object.freeze({
      updatedAt: '2026-08-18',
      periodStart: '2025-01',
      periodEnd: '2026-06',
      isDemo: true as const,
    }),
    districts: Object.freeze([]),
    monthlyMetrics: Object.freeze(monthlyMetrics),
  }) as unknown as DemoDataset;
}

describe('selectors', () => {
  it('returns exact-month ranking rows with null ranks last without mutating input', () => {
    const data = dataset(
      metric('missing-first', '2026-06'),
      metric('second', '2026-06', 2),
      metric('other-month', '2026-05', 1),
      metric('first', '2026-06', 1),
      metric('missing-last', '2026-06'),
    );
    const rows = getMonthRanking(data, '2026-06');

    expect(rows).toHaveLength(4);
    expect(rows.map(row => row.districtId)).toEqual([
      'first',
      'second',
      'missing-first',
      'missing-last',
    ]);
    expect(rows.map(row => row.rank)).toEqual([1, 2, null, null]);
    expect(data.monthlyMetrics.map(row => row.districtId)).toEqual([
      'missing-first',
      'second',
      'other-month',
      'first',
      'missing-last',
    ]);
  });

  it('returns all 18 district points in full chronological order', () => {
    const expectedMonths = Object.freeze([
      '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
      '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ]);
    const data = dataset(
      metric('other', '2025-01'),
      ...expectedMonths.toReversed().map(month => metric('fengjia', month)),
    );
    const rows = getDistrictSeries(data, 'fengjia');

    expect(rows.map(row => row.month)).toEqual(expectedMonths);
    expect(data.monthlyMetrics.slice(1).map(row => row.month)).toEqual(expectedMonths.toReversed());
  });

  it('accepts two or four unique comparison IDs and rejects invalid bounds or duplicates', () => {
    const data = dataset(
      metric('a', '2026-06', 1),
      metric('b', '2026-06', 2),
      metric('c', '2026-06', 3),
      metric('d', '2026-06', 4),
      metric('e', '2026-06', 5),
    );
    const twoRows = getComparisonRows(data, ['a', 'b']);
    const fourRows = getComparisonRows(data, ['a', 'b', 'c', 'd']);

    expect(twoRows.map(row => row.districtId)).toEqual(['a', 'b']);
    expect(fourRows.map(row => row.districtId)).toEqual(['a', 'b', 'c', 'd']);
    expect(() => getComparisonRows(data, ['a'])).toThrow(/2–4/);
    expect(() => getComparisonRows(data, ['a', 'b', 'c', 'd', 'e'])).toThrow(/2–4/);
    expect(() => getComparisonRows(data, ['a', 'a'])).toThrow(/unique/i);
    expect(data.monthlyMetrics.map(row => row.districtId)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('formats missing values as the research missing-state message', () => {
    expect(formatMetric(null, '人')).toBe('本月資料尚未提供');
    expect(formatMetric(175, '分鐘')).toBe('175 分鐘');
  });

  it('returns each available month exactly once in chronological order', () => {
    const data = dataset(
      metric('a', '2026-02'),
      metric('b', '2025-12'),
      metric('c', '2026-01'),
      metric('d', '2025-12'),
    );

    expect(getAvailableMonths(data)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(data.monthlyMetrics.map(row => row.month)).toEqual([
      '2026-02',
      '2025-12',
      '2026-01',
      '2025-12',
    ]);
  });
});
