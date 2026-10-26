import demoDataset from '../data/demo.json';
import { districtPhotoConfigs } from '../data/districts';
import type { DataStatus, DemoDataset, District, MonthlyMetric } from './types';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const dataStatuses = new Set<DataStatus>(['available', 'missing', 'demo']);
const scoreFields = [
  'revisitRate',
  'attractionScore',
  'engagementScore',
  'loyaltyScore',
  'popularityScore',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
}

function assertNullableNumber(value: unknown, field: string): asserts value is number | null {
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error(`${field} must be a finite number or null`);
  }
}

function validateDistrict(value: unknown): District {
  if (!isRecord(value)) {
    throw new Error('district must be an object');
  }

  for (const field of ['id', 'name', 'shortName'] as const) {
    assertString(value[field], `district.${field}`);
  }
  for (const field of [
    'image',
    'imageAlt',
    'imageCredit',
    'imageSourceType',
    'googlePlaceId',
  ] as const) {
    if (field in value) {
      throw new Error(`district photo metadata belongs in data/districts.ts, not JSON: ${field}`);
    }
  }
  if (!isRecord(value.location)) {
    throw new Error('district.location must be an object');
  }
  if (typeof value.location.lat !== 'number' || !Number.isFinite(value.location.lat)
    || typeof value.location.lng !== 'number' || !Number.isFinite(value.location.lng)) {
    throw new Error('district.location coordinates must be finite numbers');
  }
  assertString(value.location.label, 'district.location.label');

  return value as unknown as District;
}

function validateMetric(value: unknown, districtIds: Set<string>): MonthlyMetric {
  if (!isRecord(value)) {
    throw new Error('monthly metric must be an object');
  }
  assertString(value.districtId, 'monthlyMetric.districtId');
  assertString(value.month, 'monthlyMetric.month');
  if (!districtIds.has(value.districtId)) {
    throw new Error(`unknown district ID: ${value.districtId}`);
  }
  if (!monthPattern.test(value.month)) {
    throw new Error(`invalid YYYY-MM value: ${value.month}`);
  }

  for (const field of ['visitors', 'stayMinutes', ...scoreFields, 'rank', 'rankChange'] as const) {
    assertNullableNumber(value[field], `monthlyMetric.${field}`);
  }
  for (const field of scoreFields) {
    const score = value[field];
    if (typeof score === 'number' && (score < 0 || score > 100)) {
      throw new Error(`numeric rate ${field} must be between 0 and 100`);
    }
  }
  if (!dataStatuses.has(value.dataStatus as DataStatus)) {
    throw new Error('monthlyMetric.dataStatus is invalid');
  }

  return value as unknown as MonthlyMetric;
}

export function validateDataset(input: unknown): DemoDataset {
  if (!isRecord(input)) {
    throw new Error('dataset must be an object');
  }
  if (!isRecord(input.metadata) || input.metadata.isDemo !== true) {
    throw new Error('metadata must identify a demo dataset');
  }
  for (const field of ['updatedAt', 'periodStart', 'periodEnd'] as const) {
    assertString(input.metadata[field], `metadata.${field}`);
  }
  if (!monthPattern.test(input.metadata.periodStart as string)
    || !monthPattern.test(input.metadata.periodEnd as string)) {
    throw new Error('metadata period must use valid YYYY-MM values');
  }
  if (!Array.isArray(input.districts) || !Array.isArray(input.monthlyMetrics)) {
    throw new Error('districts and monthlyMetrics must be arrays');
  }

  const duplicateKeys = new Set<string>();
  for (const row of input.monthlyMetrics) {
    if (!isRecord(row) || typeof row.districtId !== 'string' || typeof row.month !== 'string') {
      continue;
    }
    const key = `${row.districtId}:${row.month}`;
    if (duplicateKeys.has(key)) {
      throw new Error(`duplicate district-month row: ${key}`);
    }
    duplicateKeys.add(key);
  }

  const districts = input.districts.map(validateDistrict);
  const districtIds = new Set(districts.map(district => district.id));
  if (districtIds.size !== districts.length) {
    throw new Error('duplicate district ID');
  }
  const photoDistrictIds = new Set<string>(
    districtPhotoConfigs.map((photo) => photo.districtId),
  );
  if (districts.length !== 4
    || photoDistrictIds.size !== 4
    || districts.some((district) => !photoDistrictIds.has(district.id))
    || districtPhotoConfigs.some((photo) => !districtIds.has(photo.districtId))) {
    throw new Error('districts must strictly match the four district photo configurations');
  }
  const monthlyMetrics = input.monthlyMetrics.map(row => validateMetric(row, districtIds));

  return {
    metadata: input.metadata as DemoDataset['metadata'],
    districts,
    monthlyMetrics,
  };
}

export function loadDemoDataset(): DemoDataset {
  return validateDataset(demoDataset);
}

export type DatasetLoadResult =
  | { ok: true; data: DemoDataset }
  | { ok: false };

export function safelyLoadDemoDataset(
  loader: () => DemoDataset = loadDemoDataset,
): DatasetLoadResult {
  try {
    return { ok: true, data: loader() };
  } catch {
    return { ok: false };
  }
}
