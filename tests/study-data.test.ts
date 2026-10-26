import { describe, expect, it } from 'vitest';
import coreSource from '../analysis/tourstats-formal-dataset/processed/tcdpi-core-2025-01_2026-08.json';
import qualitySource from '../analysis/tourstats-formal-dataset/processed/quality-report-2025-01_2026-08.json';
import sensitivitySource from '../analysis/tourstats-formal-dataset/processed/ranking-sensitivity-2025-01_2026-08.json';
import {
  createStudyDataset,
  getAnomaliesForMonth,
  getSensitivityForMonth,
  loadStudyDataset,
  safelyLoadStudyDataset,
} from '../lib/study-data';

function clonedSources() {
  return {
    core: structuredClone(coreSource) as unknown,
    sensitivity: structuredClone(sensitivitySource) as unknown,
    quality: structuredClone(qualitySource) as unknown,
  };
}

describe('formal popularity index dataset', () => {
  it('loads the frozen non-demo dataset with four districts and 80 unique rows', () => {
    const data = loadStudyDataset();

    expect(data.core.metadata).toMatchObject({
      isDemo: false,
      methodVersion: 'TCDPI-core-v1.1.0',
      sourceSnapshot: 'tourstats-snapshot-2026-10-22',
      periodStart: '2025-01',
      periodEnd: '2026-08',
    });
    expect(data.core.districts).toHaveLength(4);
    expect(data.core.monthlyMetrics).toHaveLength(80);
    expect(new Set(data.core.monthlyMetrics.map(
      (row) => `${row.districtId}:${row.month}`,
    )).size).toBe(80);
  });

  it('preserves the verified April 2025 base and entropy ranking swap', () => {
    const data = loadStudyDataset();
    const april = getSensitivityForMonth(data, '2025-04');

    expect(april.map(({ districtId, baseRank, entropyRank }) => ({
      districtId,
      baseRank,
      entropyRank,
    }))).toEqual([
      { districtId: 'gongyi', baseRank: 1, entropyRank: 1 },
      { districtId: 'yizhong', baseRank: 2, entropyRank: 3 },
      { districtId: 'fengjia', baseRank: 3, entropyRank: 2 },
      { districtId: 'calligraphy', baseRank: 4, entropyRank: 4 },
    ]);
    expect(getAnomaliesForMonth(data, '2025-04')).toEqual([
      expect.objectContaining({
        districtId: 'fengjia',
        metric: 'visitors',
        changePct: 66.03,
      }),
    ]);
  });

  it('rejects a core source with the wrong method version', () => {
    const sources = clonedSources();
    const core = sources.core as typeof coreSource;
    core.metadata.method_version = 'TCDPI-core-v0.9.0';

    expect(() => createStudyDataset(sources)).toThrow(/method version/i);
  });

  it('rejects duplicate district-month rows', () => {
    const sources = clonedSources();
    const core = sources.core as typeof coreSource;
    core.rows[1] = structuredClone(core.rows[0]);

    expect(() => createStudyDataset(sources)).toThrow(/duplicate district-month/i);
  });

  it('rejects sensitivity data that does not cover every study month', () => {
    const sources = clonedSources();
    const sensitivity = sources.sensitivity as typeof sensitivitySource;
    sensitivity.rows = sensitivity.rows.filter((row) => row.month !== '2025-04');
    sensitivity.agreement_by_month = sensitivity.agreement_by_month.filter(
      (row) => row.month !== '2025-04',
    );

    expect(() => createStudyDataset(sources)).toThrow(/sensitivity month coverage/i);
  });

  it('returns an explicit failure result instead of falling back to demo data', () => {
    expect(safelyLoadStudyDataset(() => {
      throw new Error('broken formal source');
    })).toEqual({ ok: false });
  });
});
