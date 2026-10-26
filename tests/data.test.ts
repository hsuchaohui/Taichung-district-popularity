import { describe, expect, it } from 'vitest';
import { loadDemoDataset, validateDataset } from '../lib/data';

describe('demo dataset', () => {
  it('contains exactly four districts and 72 unique district-month rows', () => {
    const data = loadDemoDataset();
    expect(data.districts).toHaveLength(4);
    expect(data.monthlyMetrics).toHaveLength(72);
    const keys = new Set(data.monthlyMetrics.map(row => `${row.districtId}:${row.month}`));
    expect(keys.size).toBe(72);
  });

  it('covers 2025-01 through 2026-06 and marks every row as demo', () => {
    const data = loadDemoDataset();
    const months = data.monthlyMetrics.map(row => row.month).sort();
    expect(months[0]).toBe('2025-01');
    expect(months.at(-1)).toBe('2026-06');
    expect(data.metadata.isDemo).toBe(true);
    expect(data.monthlyMetrics.every(row => row.dataStatus === 'demo')).toBe(true);
  });

  it('keeps photo metadata out of the metric dataset contract', () => {
    const data = loadDemoDataset();

    for (const district of data.districts) {
      expect(district).not.toHaveProperty('image');
      expect(district).not.toHaveProperty('imageAlt');
      expect(district).not.toHaveProperty('imageCredit');
      expect(district).not.toHaveProperty('imageSourceType');
      expect(district).not.toHaveProperty('googlePlaceId');
    }
  });

  it('rejects a district list that cannot strictly join to the four photo configs', () => {
    const data = loadDemoDataset();
    expect(() => validateDataset({
      ...data,
      districts: data.districts.map((district, index) => index === 0
        ? { ...district, id: 'unknown-district' }
        : district),
      monthlyMetrics: [],
    })).toThrow(/photo configuration/i);
  });

  it('rejects stale photo metadata in replacement JSON', () => {
    const data = loadDemoDataset();
    expect(() => validateDataset({
      ...data,
      districts: data.districts.map((district, index) => index === 0
        ? { ...district, image: '/stale.jpg' }
        : district),
    })).toThrow(/photo metadata/i);
  });

  it('rejects duplicate district-month rows', () => {
    expect(() => validateDataset({
      metadata: { updatedAt: '2026-08-18', periodStart: '2025-01', periodEnd: '2026-06', isDemo: true },
      districts: [],
      monthlyMetrics: [
        { districtId: 'x', month: '2025-01' },
        { districtId: 'x', month: '2025-01' }
      ]
    })).toThrow(/duplicate district-month/i);
  });
});
