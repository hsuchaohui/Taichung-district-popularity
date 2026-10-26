import coreSource from '../analysis/tourstats-formal-dataset/processed/tcdpi-core-2025-01_2026-08.json';
import qualitySource from '../analysis/tourstats-formal-dataset/processed/quality-report-2025-01_2026-08.json';
import sensitivitySource from '../analysis/tourstats-formal-dataset/processed/ranking-sensitivity-2025-01_2026-08.json';
import { loadDemoDataset } from './data';
import type {
  MonthlyMetric,
  PerturbationScenario,
  RankingAgreement,
  SensitivityRow,
  StudyAnomaly,
  StudyDataset,
  WeightSet,
} from './types';

const EXPECTED_METHOD_VERSION = 'TCDPI-core-v1.1.0';
const EXPECTED_SOURCE_SNAPSHOT = 'tourstats-snapshot-2026-10-22';
const EXPECTED_PERIOD_START = '2025-01';
const EXPECTED_PERIOD_END = '2026-08';
const EXPECTED_ROW_COUNT = 80;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface StudyDataSources {
  core: unknown;
  sensitivity: unknown;
  quality: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function integer(value: unknown, label: string): number {
  const result = finiteNumber(value, label);
  if (!Number.isInteger(result)) throw new Error(`${label} must be an integer`);
  return result;
}

function validateMonth(value: unknown, label: string): string {
  const result = string(value, label);
  if (!monthPattern.test(result)) throw new Error(`${label} must use YYYY-MM`);
  return result;
}

function monthsBetween(start: string, end: string): string[] {
  const result: string[] = [];
  let [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month === 13) {
      year += 1;
      month = 1;
    }
  }
  return result;
}

function readWeights(value: unknown, label: string): WeightSet {
  const weights = record(value, label);
  return {
    attraction: finiteNumber(weights.attraction, `${label}.attraction`),
    engagement: finiteNumber(weights.engagement, `${label}.engagement`),
    loyalty: finiteNumber(weights.loyalty, `${label}.loyalty`),
  };
}

export function createStudyDataset(sources: StudyDataSources): StudyDataset {
  const core = record(sources.core, 'core source');
  const metadata = record(core.metadata, 'core metadata');
  if (metadata.method_version !== EXPECTED_METHOD_VERSION) {
    throw new Error(`Unexpected method version: ${String(metadata.method_version)}`);
  }
  if (metadata.source_snapshot !== '2026-10-22') {
    throw new Error(`Unexpected source snapshot: ${String(metadata.source_snapshot)}`);
  }
  if (metadata.period_start !== EXPECTED_PERIOD_START
    || metadata.period_end !== EXPECTED_PERIOD_END) {
    throw new Error('Unexpected formal study period');
  }
  if (metadata.is_demo !== false) throw new Error('Formal study data cannot be demo data');

  const rawCoreRows = array(core.rows, 'core rows');
  if (rawCoreRows.length !== EXPECTED_ROW_COUNT
    || metadata.row_count !== EXPECTED_ROW_COUNT) {
    throw new Error(`Formal core row count must be ${EXPECTED_ROW_COUNT}`);
  }

  const displayDistricts = loadDemoDataset().districts;
  const displayDistrictIds = new Set(displayDistricts.map((district) => district.id));
  const spotCodeToDistrict = new Map<number, string>();
  const coreKeys = new Set<string>();
  const sourceVersions = new Set<string>();
  const mappedRows: MonthlyMetric[] = rawCoreRows.map(
    (rawValue, index) => {
      const raw = record(rawValue, `core row ${index}`);
      const districtId = string(raw.district_id, `core row ${index}.district_id`);
      const month = validateMonth(raw.month, `core row ${index}.month`);
      if (!displayDistrictIds.has(districtId)) {
        throw new Error(`Unknown formal district ID: ${districtId}`);
      }
      const key = `${districtId}:${month}`;
      if (coreKeys.has(key)) throw new Error(`Duplicate district-month row: ${key}`);
      coreKeys.add(key);

      const spotCode = integer(raw.spot_code, `core row ${index}.spot_code`);
      const existingDistrict = spotCodeToDistrict.get(spotCode);
      if (existingDistrict && existingDistrict !== districtId) {
        throw new Error(`Spot code ${spotCode} maps to multiple districts`);
      }
      spotCodeToDistrict.set(spotCode, districtId);
      sourceVersions.add(string(raw.source_version, `core row ${index}.source_version`));

      return {
        districtId,
        month,
        visitors: finiteNumber(raw.visitors, `core row ${index}.visitors`),
        stayMinutes: finiteNumber(raw.stay_minutes, `core row ${index}.stay_minutes`),
        revisitRate: finiteNumber(raw.revisit_rate_pct, `core row ${index}.revisit_rate_pct`),
        attractionScore: finiteNumber(raw.attraction_score, `core row ${index}.attraction_score`),
        engagementScore: finiteNumber(raw.engagement_score, `core row ${index}.engagement_score`),
        loyaltyScore: finiteNumber(raw.loyalty_score, `core row ${index}.loyalty_score`),
        popularityScore: finiteNumber(raw.tcdpi_score, `core row ${index}.tcdpi_score`),
        rank: integer(raw.rank, `core row ${index}.rank`),
        rankChange: null,
        dataStatus: 'official',
      };
    },
  );

  if (sourceVersions.size !== 1 || !sourceVersions.has(EXPECTED_SOURCE_SNAPSHOT)) {
    throw new Error('Formal rows must share the expected source snapshot');
  }
  if (spotCodeToDistrict.size !== 4) throw new Error('Formal data must contain four districts');

  const expectedMonths = monthsBetween(EXPECTED_PERIOD_START, EXPECTED_PERIOD_END);
  const coreMonths = new Set(mappedRows.map((row) => row.month));
  if (expectedMonths.some((month) => !coreMonths.has(month)) || coreMonths.size !== 20) {
    throw new Error('Formal core month coverage must contain all 20 study months');
  }

  for (const districtId of displayDistrictIds) {
    const series = mappedRows
      .filter((row) => row.districtId === districtId)
      .sort((left, right) => left.month.localeCompare(right.month));
    if (series.length !== 20) throw new Error(`District ${districtId} must contain 20 months`);
    for (let index = 1; index < series.length; index += 1) {
      const previousRank = series[index - 1].rank;
      const currentRank = series[index].rank;
      series[index].rankChange = previousRank === null || currentRank === null
        ? null
        : previousRank - currentRank;
    }
  }

  const sensitivity = record(sources.sensitivity, 'sensitivity source');
  const entropyWeights = readWeights(sensitivity.entropy_weights, 'entropy weights');
  const perturbationScenarios: PerturbationScenario[] = array(
    sensitivity.perturbation_scenarios,
    'perturbation scenarios',
  ).map((rawValue, index) => {
    const raw = record(rawValue, `perturbation scenario ${index}`);
    return {
      id: string(raw.id, `perturbation scenario ${index}.id`),
      target: string(raw.target, `perturbation scenario ${index}.target`),
      delta: finiteNumber(raw.delta, `perturbation scenario ${index}.delta`),
      weights: readWeights(raw.weights, `perturbation scenario ${index}.weights`),
    };
  });

  const sensitivityKeys = new Set<string>();
  const sensitivityRows: SensitivityRow[] = array(
    sensitivity.rows,
    'sensitivity rows',
  ).map((rawValue, index) => {
    const raw = record(rawValue, `sensitivity row ${index}`);
    const spotCode = integer(raw.spot_code, `sensitivity row ${index}.spot_code`);
    const districtId = spotCodeToDistrict.get(spotCode);
    if (!districtId) throw new Error(`Unknown sensitivity spot code: ${spotCode}`);
    const month = validateMonth(raw.month, `sensitivity row ${index}.month`);
    const key = `${districtId}:${month}`;
    if (sensitivityKeys.has(key)) throw new Error(`Duplicate sensitivity row: ${key}`);
    sensitivityKeys.add(key);
    return {
      districtId,
      month,
      baseScore: finiteNumber(raw.base_score, `sensitivity row ${index}.base_score`),
      baseRank: integer(raw.base_rank, `sensitivity row ${index}.base_rank`),
      equalScore: finiteNumber(raw.equal_score, `sensitivity row ${index}.equal_score`),
      equalRank: integer(raw.equal_rank, `sensitivity row ${index}.equal_rank`),
      entropyScore: finiteNumber(raw.entropy_score, `sensitivity row ${index}.entropy_score`),
      entropyRank: integer(raw.entropy_rank, `sensitivity row ${index}.entropy_rank`),
      perturbationRankMin: integer(
        raw.perturbation_rank_min,
        `sensitivity row ${index}.perturbation_rank_min`,
      ),
      perturbationRankMax: integer(
        raw.perturbation_rank_max,
        `sensitivity row ${index}.perturbation_rank_max`,
      ),
    };
  });

  const sensitivityMonths = new Set(sensitivityRows.map((row) => row.month));
  if (sensitivityRows.length !== EXPECTED_ROW_COUNT
    || expectedMonths.some((month) => !sensitivityMonths.has(month))
    || sensitivityMonths.size !== expectedMonths.length
    || [...coreKeys].some((key) => !sensitivityKeys.has(key))) {
    throw new Error('Sensitivity month coverage must match all formal core rows');
  }

  const agreementByMonth: RankingAgreement[] = array(
    sensitivity.agreement_by_month,
    'agreement by month',
  ).map((rawValue, index) => {
    const raw = record(rawValue, `agreement row ${index}`);
    return {
      month: validateMonth(raw.month, `agreement row ${index}.month`),
      spearmanBaseEqual: finiteNumber(raw.spearman_base_equal, `agreement row ${index}.spearman_base_equal`),
      kendallBaseEqual: finiteNumber(raw.kendall_base_equal, `agreement row ${index}.kendall_base_equal`),
      spearmanBaseEntropy: finiteNumber(raw.spearman_base_entropy, `agreement row ${index}.spearman_base_entropy`),
      kendallBaseEntropy: finiteNumber(raw.kendall_base_entropy, `agreement row ${index}.kendall_base_entropy`),
    };
  });
  const agreementMonths = new Set(agreementByMonth.map((row) => row.month));
  if (agreementByMonth.length !== expectedMonths.length
    || expectedMonths.some((month) => !agreementMonths.has(month))) {
    throw new Error('Sensitivity month coverage must include monthly agreement');
  }

  const quality = record(sources.quality, 'quality source');
  if (quality.ready !== true) throw new Error('Formal quality report is not ready');
  const anomalies: StudyAnomaly[] = array(quality.anomalies, 'quality anomalies').map(
    (rawValue, index) => {
      const raw = record(rawValue, `quality anomaly ${index}`);
      const spotCode = integer(raw.spot_code, `quality anomaly ${index}.spot_code`);
      const districtId = spotCodeToDistrict.get(spotCode);
      if (!districtId) throw new Error(`Unknown anomaly spot code: ${spotCode}`);
      return {
        severity: string(raw.severity, `quality anomaly ${index}.severity`),
        districtId,
        month: validateMonth(raw.month, `quality anomaly ${index}.month`),
        metric: string(raw.metric, `quality anomaly ${index}.metric`),
        previousValue: finiteNumber(raw.previous_value, `quality anomaly ${index}.previous_value`),
        currentValue: finiteNumber(raw.current_value, `quality anomaly ${index}.current_value`),
        changePct: finiteNumber(raw.change_pct, `quality anomaly ${index}.change_pct`),
        rule: string(raw.rule, `quality anomaly ${index}.rule`),
      };
    },
  );
  const caveats = array(quality.caveats, 'quality caveats').map(
    (value, index) => string(value, `quality caveat ${index}`),
  );

  return {
    core: {
      metadata: {
        updatedAt: string(metadata.created_at, 'core metadata.created_at'),
        periodStart: EXPECTED_PERIOD_START,
        periodEnd: EXPECTED_PERIOD_END,
        isDemo: false,
        methodVersion: EXPECTED_METHOD_VERSION,
        sourceSnapshot: EXPECTED_SOURCE_SNAPSHOT,
      },
      districts: displayDistricts,
      monthlyMetrics: mappedRows,
    },
    entropyWeights,
    perturbationScenarios,
    sensitivityRows,
    agreementByMonth,
    anomalies,
    caveats,
    qualityStatus: string(quality.status, 'quality status'),
  };
}

export function loadStudyDataset(): StudyDataset {
  return createStudyDataset({
    core: coreSource,
    sensitivity: sensitivitySource,
    quality: qualitySource,
  });
}

export type StudyDatasetLoadResult =
  | { ok: true; data: StudyDataset }
  | { ok: false };

export function safelyLoadStudyDataset(
  loader: () => StudyDataset = loadStudyDataset,
): StudyDatasetLoadResult {
  try {
    return { ok: true, data: loader() };
  } catch {
    return { ok: false };
  }
}

export function getSensitivityForMonth(
  data: StudyDataset,
  month: string,
): SensitivityRow[] {
  return data.sensitivityRows
    .filter((row) => row.month === month)
    .sort((left, right) => left.baseRank - right.baseRank);
}

export function getAnomaliesForMonth(
  data: StudyDataset,
  month: string,
): StudyAnomaly[] {
  return data.anomalies.filter((anomaly) => anomaly.month === month);
}
