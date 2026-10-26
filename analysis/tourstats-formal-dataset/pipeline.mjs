import { createHash } from 'node:crypto';

export const FORMAL_SPOTS = Object.freeze([
  { spotCode: 11, districtId: 'calligraphy', spotName: '草悟道' },
  { spotCode: 13, districtId: 'yizhong', spotName: '一中' },
  { spotCode: 21, districtId: 'fengjia', spotName: '逢甲' },
  { spotCode: 8043, districtId: 'gongyi', spotName: '公益路' },
]);

export const STUDY_START = '2025-01';
export const STUDY_END = process.env.TCDPI_STUDY_END ?? '2026-08';

export function generateMonths(start, end) {
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end)) {
    throw new Error('Months must use YYYY-MM format.');
  }
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  const startIndex = startYear * 12 + startMonth - 1;
  const endIndex = endYear * 12 + endMonth - 1;
  if (startIndex > endIndex || startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
    throw new Error('Invalid month range.');
  }

  return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
    const monthIndex = startIndex + offset;
    const year = Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });
}

export function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function extractMetric(metric, envelope) {
  if (!envelope || envelope.success !== true) {
    throw new Error(`Official response unsuccessful: ${envelope?.message ?? 'unknown error'}`);
  }

  const value = metric === 'population'
    ? envelope.data?.total
    : metric === 'stay-time'
      ? envelope.data?.stayMinutes
      : metric === 'revisit'
        ? envelope.data
        : undefined;

  if (!Number.isFinite(value)) {
    throw new Error(`Official response has no finite ${metric} value.`);
  }
  return value;
}

export function classifyAvailabilityResponse(metric, envelope) {
  try {
    const value = extractMetric(metric, envelope);
    if (metric === 'population' && value === 0) {
      return { status: 'success_but_empty', value };
    }
    return { status: 'available', value };
  } catch (error) {
    return { status: 'endpoint_failed', value: null, message: error.message };
  }
}

export function rawResponsePath(spotCode, month, metric) {
  if (!Number.isInteger(Number(spotCode)) || !/^\d+$/.test(String(spotCode))) {
    throw new Error('Invalid spot code for raw response path.');
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Invalid month for raw response path.');
  }
  if (!['population', 'stay-time', 'revisit'].includes(metric)) {
    throw new Error('Invalid metric for raw response path.');
  }
  return `metrics/${spotCode}/${month}/${metric}.json`;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvStringify(rows, columns) {
  return `${columns.map(csvEscape).join(',')}\n${rows.map(row => columns.map(column => csvEscape(row[column])).join(',')).join('\n')}\n`;
}

export function validateRawEnvelope(body, metric = null) {
  let envelope;
  try {
    envelope = JSON.parse(body);
  } catch (error) {
    throw new Error(`Invalid JSON response: ${error.message}`);
  }
  if (!envelope || envelope.success !== true) {
    throw new Error(`Official response unsuccessful: ${envelope?.message ?? 'unknown error'}`);
  }
  if (metric) extractMetric(metric, envelope);
  return envelope;
}

export function buildManifestRecord({
  relativePath,
  requestUrl,
  body,
  envelope,
  fetchedAt,
  httpStatus,
  contentType,
  sourceVersion = 'tourstats-snapshot-2026-10-08',
  methodVersion = 'TCDPI-core-v1.0.0',
}) {
  return {
    raw_file: relativePath,
    request_url: requestUrl,
    fetched_at: fetchedAt,
    timezone: 'Asia/Taipei',
    http_status: httpStatus,
    content_type: contentType,
    response_id: envelope?.id ?? '',
    success: envelope?.success ?? '',
    sha256: sha256(body),
    source_version: sourceVersion,
    method_version: methodVersion,
  };
}

export function buildNormalizedRows({
  spots,
  formalSpots,
  months,
  responses,
  fetchedAt,
  sourceVersion = 'tourstats-snapshot-2026-10-08',
  methodVersion = 'TCDPI-core-v1.0.0',
}) {
  const officialSpots = new Map(spots.map(spot => [Number(spot.spotCode), spot]));
  const rows = [];
  for (const formalSpot of formalSpots) {
    const officialSpot = officialSpots.get(formalSpot.spotCode);
    if (!officialSpot?.wkt) throw new Error(`Missing official WKT for spot ${formalSpot.spotCode}.`);
    parseWkt(officialSpot.wkt);
    for (const month of months) {
      const key = metric => `${formalSpot.spotCode}|${month}|${metric}`;
      const population = responses.get(key('population'));
      const stay = responses.get(key('stay-time'));
      const revisit = responses.get(key('revisit'));
      if (!population || !stay || !revisit) {
        throw new Error(`Missing official response for spot ${formalSpot.spotCode}, month ${month}.`);
      }
      rows.push({
        spot_code: formalSpot.spotCode,
        district_id: formalSpot.districtId,
        spot_name: formalSpot.spotName,
        official_name: officialSpot.name,
        official_full_name: officialSpot.fullName,
        month,
        visitors: extractMetric('population', population),
        stay_minutes: extractMetric('stay-time', stay),
        revisit_rate_pct: extractMetric('revisit', revisit),
        data_status: 'official',
        crs: 'EPSG:4326',
        boundary_sha256: sha256(officialSpot.wkt),
        population_response_id: population.id ?? '',
        stay_response_id: stay.id ?? '',
        revisit_response_id: revisit.id ?? '',
        fetched_at: fetchedAt,
        source_version: sourceVersion,
        method_version: methodVersion,
      });
    }
  }
  return rows;
}

function splitTopLevel(input) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === '(') depth += 1;
    if (input[index] === ')') depth -= 1;
    if (input[index] === ',' && depth === 0) {
      parts.push(input.slice(start, index).trim());
      start = index + 1;
    }
    if (depth < 0) throw new Error('Malformed WKT parentheses.');
  }
  if (depth !== 0) throw new Error('Malformed WKT parentheses.');
  parts.push(input.slice(start).trim());
  return parts;
}

function stripOuterParens(input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
    throw new Error('Malformed WKT group.');
  }
  return trimmed.slice(1, -1).trim();
}

function parseRing(input) {
  const coordinates = input.split(',').map(pair => {
    const values = pair.trim().split(/\s+/).map(Number);
    if (values.length !== 2 || !values.every(Number.isFinite)) {
      throw new Error('Malformed WKT coordinate.');
    }
    return values;
  });
  if (coordinates.length < 4) throw new Error('WKT ring needs at least four coordinates.');
  if (coordinates[0][0] !== coordinates.at(-1)[0] || coordinates[0][1] !== coordinates.at(-1)[1]) {
    throw new Error('WKT ring is not closed.');
  }
  const orientation = (a, b, c) => {
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return Math.abs(cross) < 1e-12 ? 0 : Math.sign(cross);
  };
  const onSegment = (a, b, point) => (
    point[0] >= Math.min(a[0], b[0]) - 1e-12
    && point[0] <= Math.max(a[0], b[0]) + 1e-12
    && point[1] >= Math.min(a[1], b[1]) - 1e-12
    && point[1] <= Math.max(a[1], b[1]) + 1e-12
  );
  const intersects = (a, b, c, d) => {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    return (o1 === 0 && onSegment(a, b, c))
      || (o2 === 0 && onSegment(a, b, d))
      || (o3 === 0 && onSegment(c, d, a))
      || (o4 === 0 && onSegment(c, d, b));
  };
  const segmentCount = coordinates.length - 1;
  for (let first = 0; first < segmentCount; first += 1) {
    for (let second = first + 1; second < segmentCount; second += 1) {
      const adjacent = second === first + 1 || (first === 0 && second === segmentCount - 1);
      if (!adjacent && intersects(
        coordinates[first],
        coordinates[first + 1],
        coordinates[second],
        coordinates[second + 1],
      )) {
        throw new Error('WKT ring is self-intersecting.');
      }
    }
  }
  const signedDoubleArea = coordinates.slice(0, -1).reduce((sum, point, index) => {
    const next = coordinates[(index + 1) % segmentCount];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  if (Math.abs(signedDoubleArea) < 1e-12) throw new Error('WKT ring has zero area.');
  return coordinates;
}

function parsePolygonGroup(group) {
  return splitTopLevel(stripOuterParens(group)).map(ring => parseRing(stripOuterParens(ring)));
}

export function parseWkt(wkt) {
  if (typeof wkt !== 'string') throw new Error('WKT must be a string.');
  const match = wkt.trim().match(/^(POLYGON|MULTIPOLYGON)\s*(\(.+\))$/is);
  if (!match) throw new Error('Only POLYGON and MULTIPOLYGON WKT are supported.');
  const [, type, body] = match;
  if (type.toUpperCase() === 'POLYGON') {
    return { type: 'Polygon', coordinates: parsePolygonGroup(body) };
  }
  const polygons = splitTopLevel(stripOuterParens(body)).map(parsePolygonGroup);
  return { type: 'MultiPolygon', coordinates: polygons };
}

function percentile(sortedValues, probability) {
  if (sortedValues.length === 0) throw new Error('Cannot calculate a percentile from no values.');
  const position = (sortedValues.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  const fraction = position - lower;
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * fraction;
}

function fitMetric(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const p01 = percentile(sorted, 0.01);
  const p99 = percentile(sorted, 0.99);
  const winsorized = values.map(value => Math.min(p99, Math.max(p01, value)));
  const minimum = Math.min(...winsorized);
  const maximum = Math.max(...winsorized);
  return { p01, p99, minimum, maximum };
}

function scaleMetric(value, parameters) {
  const clipped = Math.min(parameters.p99, Math.max(parameters.p01, value));
  if (parameters.maximum === parameters.minimum) return 50;
  return Math.min(100, Math.max(0, ((clipped - parameters.minimum) / (parameters.maximum - parameters.minimum)) * 100));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function computeTcdpi(inputRows) {
  if (!Array.isArray(inputRows) || inputRows.length === 0) throw new Error('TCDPI needs at least one row.');
  const transformed = inputRows.map(row => ({
    ...row,
    _visitors_log1p: Math.log1p(row.visitors),
  }));
  const parameters = {
    attraction: fitMetric(transformed.map(row => row._visitors_log1p)),
    engagement: fitMetric(transformed.map(row => row.stay_minutes)),
    loyalty: fitMetric(transformed.map(row => row.revisit_rate_pct)),
  };
  let rows = transformed.map(({ _visitors_log1p, ...row }) => {
    const attraction = scaleMetric(_visitors_log1p, parameters.attraction);
    const engagement = scaleMetric(row.stay_minutes, parameters.engagement);
    const loyalty = scaleMetric(row.revisit_rate_pct, parameters.loyalty);
    return {
      ...row,
      attraction_score: round(attraction),
      engagement_score: round(engagement),
      loyalty_score: round(loyalty),
      tcdpi_score: round(0.4 * attraction + 0.3 * engagement + 0.3 * loyalty),
    };
  });

  const byMonth = Map.groupBy(rows, row => row.month);
  for (const monthRows of byMonth.values()) {
    monthRows.sort((a, b) => b.tcdpi_score - a.tcdpi_score || a.spot_code - b.spot_code);
    monthRows.forEach((row, index) => { row.rank = index + 1; });
  }
  rows = [...byMonth.values()].flat().sort((a, b) => a.month.localeCompare(b.month) || a.rank - b.rank);
  return { rows, baseline: parameters };
}

export function validateFormalRows(rows, options = {}) {
  const expectedSpots = options.expectedSpots ?? FORMAL_SPOTS.map(spot => spot.spotCode);
  const expectedMonths = options.expectedMonths ?? generateMonths(STUDY_START, STUDY_END);
  const expectedKeys = new Set(expectedSpots.flatMap(spotCode => expectedMonths.map(month => `${spotCode}|${month}`)));
  const actualKeys = new Set();
  const errors = [];
  const warnings = [];

  if (rows.length !== expectedKeys.size) errors.push(`Expected ${expectedKeys.size} rows, found ${rows.length}.`);
  for (const [index, row] of rows.entries()) {
    const key = `${row.spot_code}|${row.month}`;
    if (actualKeys.has(key)) errors.push(`Duplicate spot-month key: ${key}.`);
    actualKeys.add(key);
    if (!expectedKeys.has(key)) errors.push(`Unexpected spot-month key: ${key}.`);
    if (!Number.isFinite(row.visitors) || row.visitors <= 0) errors.push(`Row ${index + 1} visitors must be greater than zero.`);
    if (!Number.isFinite(row.stay_minutes) || row.stay_minutes <= 0) errors.push(`Row ${index + 1} stay_minutes must be greater than zero.`);
    if (!Number.isFinite(row.revisit_rate_pct) || row.revisit_rate_pct < 0 || row.revisit_rate_pct > 100) {
      errors.push(`Row ${index + 1} revisit_rate_pct must be between 0 and 100.`);
    }
  }
  for (const key of expectedKeys) {
    if (!actualKeys.has(key)) errors.push(`Missing spot-month key: ${key}.`);
  }

  return {
    ready: errors.length === 0,
    row_count: rows.length,
    unique_key_count: actualKeys.size,
    expected_row_count: expectedKeys.size,
    errors,
    warnings,
  };
}

export function validateManifestCoverage(manifest, expectedPaths) {
  const errors = [];
  const counts = new Map();
  for (const record of manifest) {
    counts.set(record.raw_file, (counts.get(record.raw_file) ?? 0) + 1);
    if (!/^[a-f0-9]{64}$/.test(record.sha256 ?? '')) errors.push(`Invalid SHA-256 for ${record.raw_file}.`);
  }
  for (const [path, count] of counts) {
    if (count > 1) errors.push(`Duplicate manifest path: ${path}.`);
    if (!expectedPaths.includes(path)) errors.push(`Unexpected manifest path: ${path}.`);
  }
  for (const path of expectedPaths) {
    if (!counts.has(path)) errors.push(`Missing manifest path: ${path}.`);
  }
  return { valid: errors.length === 0, errors };
}

export function assertArtifactMatches(label, savedContent, expectedContent) {
  if (savedContent !== expectedContent) throw new Error(`${label} artifact drift detected.`);
}

function rankByScore(rows, scoreField) {
  const result = new Map();
  const byMonth = Map.groupBy(rows, row => row.month);
  for (const monthRows of byMonth.values()) {
    [...monthRows]
      .sort((a, b) => b[scoreField] - a[scoreField] || a.spot_code - b.spot_code)
      .forEach((row, index) => result.set(`${row.spot_code}|${row.month}`, index + 1));
  }
  return result;
}

function correlationForRanks(left, right) {
  const n = left.length;
  const squaredDifference = left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0);
  const spearman = n < 2 ? 1 : 1 - (6 * squaredDifference) / (n * (n ** 2 - 1));
  let concordant = 0;
  let discordant = 0;
  for (let first = 0; first < n; first += 1) {
    for (let second = first + 1; second < n; second += 1) {
      const direction = Math.sign(left[first] - left[second]) * Math.sign(right[first] - right[second]);
      if (direction > 0) concordant += 1;
      if (direction < 0) discordant += 1;
    }
  }
  const pairs = n * (n - 1) / 2;
  return { spearman: round(spearman, 6), kendall: pairs === 0 ? 1 : round((concordant - discordant) / pairs, 6) };
}

function entropyWeights(rows) {
  const fields = ['attraction_score', 'engagement_score', 'loyalty_score'];
  const divergences = fields.map(field => {
    const values = rows.map(row => Math.max(0, row[field]));
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total === 0 || rows.length <= 1) return 0;
    const entropy = -values.reduce((sum, value) => {
      if (value === 0) return sum;
      const probability = value / total;
      return sum + probability * Math.log(probability);
    }, 0) / Math.log(rows.length);
    return Math.max(0, 1 - entropy);
  });
  const totalDivergence = divergences.reduce((sum, value) => sum + value, 0);
  const weights = totalDivergence === 0 ? [1 / 3, 1 / 3, 1 / 3] : divergences.map(value => value / totalDivergence);
  return {
    attraction: weights[0],
    engagement: weights[1],
    loyalty: weights[2],
  };
}

function adjustedWeights(target, delta) {
  const base = { attraction: 0.4, engagement: 0.3, loyalty: 0.3 };
  const nextTarget = base[target] + delta;
  const remainingBase = 1 - base[target];
  const remainingNext = 1 - nextTarget;
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [
    key,
    key === target ? nextTarget : value / remainingBase * remainingNext,
  ]));
}

export function computeSensitivityAnalysis(inputRows) {
  const entropy = entropyWeights(inputRows);
  const prepared = inputRows.map(row => ({
    ...row,
    equal_score: round((row.attraction_score + row.engagement_score + row.loyalty_score) / 3),
    entropy_score: round(
      entropy.attraction * row.attraction_score
      + entropy.engagement * row.engagement_score
      + entropy.loyalty * row.loyalty_score,
    ),
  }));
  const baseRanks = rankByScore(prepared, 'tcdpi_score');
  const equalRanks = rankByScore(prepared, 'equal_score');
  const entropyRanks = rankByScore(prepared, 'entropy_score');
  const scenarios = [];
  const scenarioRanks = [];
  for (const target of ['attraction', 'engagement', 'loyalty']) {
    for (const delta of [-0.1, 0.1]) {
      const weights = adjustedWeights(target, delta);
      const id = `${target}_${delta < 0 ? 'minus' : 'plus'}_10pp`;
      const scenarioRows = prepared.map(row => ({
        ...row,
        [id]: round(
          weights.attraction * row.attraction_score
          + weights.engagement * row.engagement_score
          + weights.loyalty * row.loyalty_score,
        ),
      }));
      scenarios.push({ id, target, delta, weights });
      scenarioRanks.push({ id, ranks: rankByScore(scenarioRows, id) });
    }
  }

  const rows = prepared.map(row => {
    const key = `${row.spot_code}|${row.month}`;
    const perturbedRanks = scenarioRanks.map(scenario => scenario.ranks.get(key));
    return {
      spot_code: row.spot_code,
      month: row.month,
      base_score: row.tcdpi_score,
      base_rank: baseRanks.get(key),
      equal_score: row.equal_score,
      equal_rank: equalRanks.get(key),
      entropy_score: row.entropy_score,
      entropy_rank: entropyRanks.get(key),
      perturbation_rank_min: Math.min(...perturbedRanks),
      perturbation_rank_max: Math.max(...perturbedRanks),
    };
  });
  const agreementByMonth = [...new Set(rows.map(row => row.month))].sort().map(month => {
    const monthRows = rows.filter(row => row.month === month).sort((a, b) => a.spot_code - b.spot_code);
    const base = monthRows.map(row => row.base_rank);
    const equal = monthRows.map(row => row.equal_rank);
    const entropyRanksForMonth = monthRows.map(row => row.entropy_rank);
    const baseEqual = correlationForRanks(base, equal);
    const baseEntropy = correlationForRanks(base, entropyRanksForMonth);
    return {
      month,
      spearman_base_equal: baseEqual.spearman,
      kendall_base_equal: baseEqual.kendall,
      spearman_base_entropy: baseEntropy.spearman,
      kendall_base_entropy: baseEntropy.kendall,
    };
  });
  return {
    entropy_weights: entropy,
    perturbation_scenarios: scenarios,
    rows,
    agreement_by_month: agreementByMonth,
  };
}
