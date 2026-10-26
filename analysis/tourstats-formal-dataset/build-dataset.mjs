import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FORMAL_SPOTS,
  STUDY_END,
  STUDY_START,
  assertArtifactMatches,
  buildManifestRecord,
  buildNormalizedRows,
  classifyAvailabilityResponse,
  computeSensitivityAnalysis,
  computeTcdpi,
  csvStringify,
  generateMonths,
  parseWkt,
  rawResponsePath,
  sha256,
  validateFormalRows,
  validateManifestCoverage,
  validateRawEnvelope,
} from './pipeline.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DATE = process.env.TCDPI_SNAPSHOT_DATE ?? '2026-10-08';
const SOURCE_VERSION = `tourstats-snapshot-${SNAPSHOT_DATE}`;
const METHOD_VERSION = SNAPSHOT_DATE === '2026-10-08' ? 'TCDPI-core-v1.0.0' : 'TCDPI-core-v1.1.0';
const DATASET_VERSION = SNAPSHOT_DATE === '2026-10-08' ? '1.0.0' : '1.1.0';
const LEGACY_SNAPSHOT = SNAPSHOT_DATE === '2026-10-08';
const RAW_DIR = join(SCRIPT_DIR, 'raw', SNAPSHOT_DATE);
const METADATA_DIR = LEGACY_SNAPSHOT ? join(SCRIPT_DIR, 'metadata') : join(SCRIPT_DIR, 'metadata', SNAPSHOT_DATE);
const PROCESSED_DIR = join(SCRIPT_DIR, 'processed');
const BASE_URL = 'https://tourstats.taichung.gov.tw';
const MONTHS = generateMonths(STUDY_START, STUDY_END);
const PERIOD_SUFFIX = `${STUDY_START}_${STUDY_END}`;
const DATASET_JSON = `tcdpi-core-${PERIOD_SUFFIX}.json`;
const DATASET_CSV = `tcdpi-core-${PERIOD_SUFFIX}.csv`;
const SENSITIVITY_JSON = LEGACY_SNAPSHOT ? 'ranking-sensitivity.json' : `ranking-sensitivity-${PERIOD_SUFFIX}.json`;
const SENSITIVITY_CSV = LEGACY_SNAPSHOT ? 'ranking-sensitivity.csv' : `ranking-sensitivity-${PERIOD_SUFFIX}.csv`;
const QUALITY_JSON = LEGACY_SNAPSHOT ? 'quality-report.json' : `quality-report-${PERIOD_SUFFIX}.json`;
const QUALITY_MD = LEGACY_SNAPSHOT ? 'quality-report.md' : `quality-report-${PERIOD_SUFFIX}.md`;
const GEOJSON_FILE = LEGACY_SNAPSHOT ? 'districts.geojson' : `districts-${SNAPSHOT_DATE}.geojson`;
const METRICS = [
  { id: 'population', endpoint: '/Api/Report/GetPopulation' },
  { id: 'stay-time', endpoint: '/Api/Report/GetStayTime' },
  { id: 'revisit', endpoint: '/Api/Report/GetRevisit' },
];
const EXPECTED_METRIC_RESPONSES = FORMAL_SPOTS.length * MONTHS.length * METRICS.length;
const EXPECTED_BOUNDARY_HASHES = new Map([
  [11, '4050d1036a14a2f881ca5d04242e5bf4849c67ea27e4572d75864a93922e64e1'],
  [13, '27350ddd12667a16f2ab02140a6f1a4b87c75aa4c5854e5ff649726ac109e9e2'],
  [21, 'f7323d41a81926f22cd285cf24fe99da6afb3e149ac6e071ce10b821df9eac5a'],
  [8043, '4e3e0af177559d1b3c6c1769c4cb3ad3198026ec2f99b9aec5ced27315777dfb'],
]);
const JUNE_2026_ANCHORS = new Map([
  [11, { visitors: 490158, stay_minutes: 160, revisit_rate_pct: 78 }],
  [13, { visitors: 991262, stay_minutes: 162, revisit_rate_pct: 81.8 }],
  [21, { visitors: 647523, stay_minutes: 235, revisit_rate_pct: 72.04 }],
  [8043, { visitors: 1396487, stay_minutes: 175, revisit_rate_pct: 84.2 }],
]);
const DOCUMENTS = [
  ['home', '/', '網站首頁'],
  ['license-terms', '/AboutPlatform/LicenseTerms', '授權條款'],
  ['indicator-definitions', '/AboutPlatform/IndexCommonality', '指標共通性定義'],
  ['spot-change-log', '/AboutPlatform/SpotChangeLog', '景點範圍變動歷程'],
  ['platform-about', '/AboutPlatform/Index', '關於平臺'],
];

function sleep(milliseconds) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function atomicWrite(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, content);
  await rename(temporaryPath, path);
}

async function fetchWithRetry(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'TCDPI-research-snapshot/1.0 (+offline academic dataset)' },
      });
      if (!response.ok) {
        const retryAfter = Number(response.headers.get('retry-after'));
        if (response.status === 429 && Number.isFinite(retryAfter)) await sleep(retryAfter * 1000);
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return {
        body: await response.text(),
        httpStatus: response.status,
        contentType: response.headers.get('content-type') ?? '',
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(400 * (2 ** (attempt - 1)));
    }
  }
  throw new Error(`Unable to fetch ${url}: ${lastError?.message ?? 'unknown error'}`);
}

async function readOrFetchJson({ url, outputPath, relativePath, metric = null, priorRecord = null }) {
  if (await exists(outputPath)) {
    const body = await readFile(outputPath, 'utf8');
    const envelope = validateRawEnvelope(body, metric);
    const currentHash = sha256(body);
    if (priorRecord && currentHash !== priorRecord.sha256) {
      throw new Error(`Existing raw file differs from saved manifest: ${relativePath}.`);
    }
    if (priorRecord && priorRecord.request_url !== url) {
      throw new Error(`Request URL drift for saved raw file: ${relativePath}.`);
    }
    if (priorRecord) return { body, envelope, manifest: priorRecord, reused: true };
    const fileStat = await stat(outputPath);
    return {
      body,
      envelope,
      manifest: buildManifestRecord({
        relativePath,
        requestUrl: url,
        body,
        envelope,
        fetchedAt: fileStat.mtime.toISOString(),
        httpStatus: 200,
        contentType: 'application/json',
      sourceVersion: SOURCE_VERSION,
      methodVersion: METHOD_VERSION,
      }),
      reused: true,
    };
  }

  const fetched = await fetchWithRetry(url);
  const envelope = validateRawEnvelope(fetched.body, metric);
  if (priorRecord && sha256(fetched.body) !== priorRecord.sha256) {
    throw new Error(`Refetched raw file differs from saved manifest: ${relativePath}.`);
  }
  if (priorRecord && priorRecord.request_url !== url) {
    throw new Error(`Request URL drift for refetched raw file: ${relativePath}.`);
  }
  await atomicWrite(outputPath, fetched.body);
  if (priorRecord) return { body: fetched.body, envelope, manifest: priorRecord, reused: false };
  const fetchedAt = new Date().toISOString();
  return {
    body: fetched.body,
    envelope,
    manifest: buildManifestRecord({
      relativePath,
      requestUrl: url,
      body: fetched.body,
      envelope,
      fetchedAt,
      httpStatus: fetched.httpStatus,
      contentType: fetched.contentType,
    sourceVersion: SOURCE_VERSION,
    methodVersion: METHOD_VERSION,
    }),
    reused: false,
  };
}

async function fetchDocuments(manifest, priorManifestByPath) {
  for (const [id, route] of DOCUMENTS) {
    const outputPath = join(RAW_DIR, 'pages', `${id}.html`);
    const url = `${BASE_URL}${route}`;
    let body;
    let fetchedAt;
    let httpStatus = 200;
    let contentType = 'text/html';
    if (await exists(outputPath)) {
      body = await readFile(outputPath, 'utf8');
      const priorRecord = priorManifestByPath.get(`pages/${id}.html`);
      if (priorRecord && sha256(body) !== priorRecord.sha256) {
        throw new Error(`Existing source document differs from saved manifest: pages/${id}.html.`);
      }
      if (priorRecord) {
        manifest.push(priorRecord);
        continue;
      }
      fetchedAt = (await stat(outputPath)).mtime.toISOString();
    } else {
      const fetched = await fetchWithRetry(url);
      body = fetched.body;
      fetchedAt = new Date().toISOString();
      httpStatus = fetched.httpStatus;
      contentType = fetched.contentType;
      await atomicWrite(outputPath, body);
      await sleep(120);
    }
    manifest.push(buildManifestRecord({
      relativePath: relative(RAW_DIR, outputPath),
      requestUrl: url,
      body,
      envelope: null,
      fetchedAt,
      httpStatus,
      contentType,
      sourceVersion: SOURCE_VERSION,
      methodVersion: METHOD_VERSION,
    }));
  }
}

async function collectSnapshot({ verifyOnly, priorManifestByPath }) {
  const manifest = [];
  const responses = new Map();
  const metadataRequests = [
    ['date-scope.json', `${BASE_URL}/Api/Report/GetDateScope`],
    ['spots.json', `${BASE_URL}/Api/Report/GetSpots`],
  ];
  const metadata = {};

  for (const [filename, url] of metadataRequests) {
    const outputPath = join(RAW_DIR, filename);
    if (verifyOnly && !(await exists(outputPath))) throw new Error(`Missing raw file: ${outputPath}`);
    const result = await readOrFetchJson({
      url,
      outputPath,
      relativePath: filename,
      priorRecord: priorManifestByPath.get(filename),
    });
    metadata[filename] = result.envelope;
    manifest.push(result.manifest);
    if (!verifyOnly && !result.reused) await sleep(120);
  }

  for (const spot of FORMAL_SPOTS) {
    for (const month of MONTHS) {
      for (const metric of METRICS) {
        const relativePath = rawResponsePath(spot.spotCode, month, metric.id);
        const outputPath = join(RAW_DIR, relativePath);
        if (verifyOnly && !(await exists(outputPath))) throw new Error(`Missing raw file: ${outputPath}`);
        const query = new URLSearchParams({
          spotCode: String(spot.spotCode),
          start: month,
          end: month,
          type: 'false',
        });
        const url = `${BASE_URL}${metric.endpoint}?${query}`;
        const result = await readOrFetchJson({
          url,
          outputPath,
          relativePath,
          metric: metric.id,
          priorRecord: priorManifestByPath.get(relativePath),
        });
        responses.set(`${spot.spotCode}|${month}|${metric.id}`, result.envelope);
        manifest.push(result.manifest);
        if (!verifyOnly && !result.reused) await sleep(120);
      }
    }
  }

  if (!verifyOnly) await fetchDocuments(manifest, priorManifestByPath);
  return { manifest, responses, dateScope: metadata['date-scope.json'], spots: metadata['spots.json'] };
}

async function collectAvailabilityChecks({ verifyOnly }) {
  const records = [];
  for (const month of ['2026-09', '2026-10']) {
    for (const spot of FORMAL_SPOTS) {
      for (const metric of METRICS) {
        const relativePath = `availability/${month}/${spot.spotCode}/${metric.id}.json`;
        const outputPath = join(RAW_DIR, relativePath);
        const query = new URLSearchParams({
          spotCode: String(spot.spotCode),
          start: month,
          end: month,
          type: 'false',
        });
        const requestUrl = `${BASE_URL}${metric.endpoint}?${query}`;
        let body;
        let fetchedAt;
        let httpStatus;
        let contentType;
        if (await exists(outputPath)) {
          body = await readFile(outputPath, 'utf8');
          fetchedAt = (await stat(outputPath)).mtime.toISOString();
          httpStatus = 200;
          contentType = 'application/json';
        } else {
          if (verifyOnly) throw new Error(`Missing availability-check raw file: ${relativePath}.`);
          const fetched = await fetchWithRetry(requestUrl);
          body = fetched.body;
          fetchedAt = new Date().toISOString();
          httpStatus = fetched.httpStatus;
          contentType = fetched.contentType;
          await atomicWrite(outputPath, body);
          await sleep(120);
        }
        let envelope;
        try {
          envelope = JSON.parse(body);
        } catch {
          envelope = null;
        }
        const assessment = envelope
          ? classifyAvailabilityResponse(metric.id, envelope)
          : { status: 'invalid_response', value: null, message: 'Response body is not valid JSON.' };
        records.push({
          raw_file: relativePath,
          request_url: requestUrl,
          fetched_at: fetchedAt,
          timezone: 'Asia/Taipei',
          http_status: httpStatus,
          content_type: contentType,
          response_id: envelope?.id ?? '',
          success: envelope?.success ?? false,
          value: assessment.value,
          classification: assessment.status,
          message: assessment.message ?? envelope?.message ?? '',
          sha256: sha256(body),
          source_version: SOURCE_VERSION,
          method_version: METHOD_VERSION,
        });
      }
    }
  }
  return records;
}

function expectedRawPaths() {
  return [
    'date-scope.json',
    'spots.json',
    ...FORMAL_SPOTS.flatMap(spot => MONTHS.flatMap(month => METRICS.map(metric => rawResponsePath(spot.spotCode, month, metric.id)))),
    ...DOCUMENTS.map(([id]) => `pages/${id}.html`),
  ];
}

function addRawHashes(rows, manifest) {
  const hashes = new Map(manifest.map(record => [record.raw_file, record.sha256]));
  return rows.map(row => ({
    ...row,
    population_raw_sha256: hashes.get(rawResponsePath(row.spot_code, row.month, 'population')) ?? '',
    stay_raw_sha256: hashes.get(rawResponsePath(row.spot_code, row.month, 'stay-time')) ?? '',
    revisit_raw_sha256: hashes.get(rawResponsePath(row.spot_code, row.month, 'revisit')) ?? '',
  }));
}

function buildGeoJson(spots) {
  const spotMap = new Map(spots.data.map(spot => [Number(spot.spotCode), spot]));
  return {
    type: 'FeatureCollection',
    name: `tcdpi-formal-districts-${SNAPSHOT_DATE}`,
    features: FORMAL_SPOTS.map(formalSpot => {
      const spot = spotMap.get(formalSpot.spotCode);
      if (!spot?.wkt) throw new Error(`Missing WKT for spot ${formalSpot.spotCode}.`);
      return {
        type: 'Feature',
        id: formalSpot.spotCode,
        properties: {
          spot_code: formalSpot.spotCode,
          district_id: formalSpot.districtId,
          spot_name: formalSpot.spotName,
          official_name: spot.name,
          official_full_name: spot.fullName,
          center_lat: spot.lat,
          center_lon: spot.lon,
          crs: 'EPSG:4326',
          crs_basis: 'Observed in official website frontend implementation; agency confirmation pending.',
          boundary_sha256: sha256(spot.wkt),
          wkt: spot.wkt,
        },
        geometry: parseWkt(spot.wkt),
      };
    }),
  };
}

function findTemporalAnomalies(rows) {
  const anomalies = [];
  for (const spot of FORMAL_SPOTS) {
    const spotRows = rows.filter(row => row.spot_code === spot.spotCode).sort((a, b) => a.month.localeCompare(b.month));
    for (let index = 1; index < spotRows.length; index += 1) {
      const previous = spotRows[index - 1];
      const current = spotRows[index];
      const visitorsChangePct = ((current.visitors - previous.visitors) / previous.visitors) * 100;
      if (Math.abs(visitorsChangePct) >= 50) {
        anomalies.push({
          severity: 'warning',
          spot_code: spot.spotCode,
          month: current.month,
          metric: 'visitors',
          previous_value: previous.visitors,
          current_value: current.visitors,
          change_pct: Math.round(visitorsChangePct * 100) / 100,
          rule: 'absolute month-over-month change >= 50%',
        });
      }
    }
  }
  return anomalies;
}

function buildQualityReport({ rows, scoredRows, dateScope, manifest, geojson }) {
  const base = validateFormalRows(rows);
  const errors = [...base.errors];
  const warnings = [...base.warnings];
  const dateMax = String(dateScope.data?.dateMax ?? '').slice(0, 7);
  if (dateMax < STUDY_END) errors.push(`Official dateMax ${dateMax} does not cover ${STUDY_END}.`);

  for (const feature of geojson.features) {
    const expectedHash = EXPECTED_BOUNDARY_HASHES.get(feature.properties.spot_code);
    if (feature.properties.boundary_sha256 !== expectedHash) {
      errors.push(`Boundary hash drift for spot ${feature.properties.spot_code}.`);
    }
  }

  for (const row of rows.filter(candidate => candidate.month === '2026-06')) {
    const expected = JUNE_2026_ANCHORS.get(row.spot_code);
    for (const field of ['visitors', 'stay_minutes', 'revisit_rate_pct']) {
      if (row[field] !== expected[field]) errors.push(`2026-06 anchor mismatch for spot ${row.spot_code} ${field}.`);
    }
  }

  for (const row of scoredRows) {
    for (const field of ['attraction_score', 'engagement_score', 'loyalty_score', 'tcdpi_score']) {
      if (!Number.isFinite(row[field]) || row[field] < 0 || row[field] > 100) {
        errors.push(`Invalid ${field} for ${row.spot_code}|${row.month}.`);
      }
    }
  }

  const metricManifestCount = manifest.filter(record => record.raw_file.startsWith('metrics/')).length;
  if (metricManifestCount !== EXPECTED_METRIC_RESPONSES) errors.push(`Expected ${EXPECTED_METRIC_RESPONSES} metric manifest records, found ${metricManifestCount}.`);
  const anomalies = findTemporalAnomalies(rows);
  if (anomalies.length > 0) warnings.push(`${anomalies.length} temporal anomalies were flagged and retained.`);

  return {
    status: errors.length === 0 ? (warnings.length === 0 ? 'Ready within reviewed scope' : 'Share with caveats') : 'Needs revision',
    ready: errors.length === 0,
    generated_at: new Date().toISOString(),
    study_period: { start: STUDY_START, end: STUDY_END },
    grain: 'functional-commercial-area-month',
    checks: {
      row_count: rows.length,
      expected_row_count: FORMAL_SPOTS.length * MONTHS.length,
      unique_key_count: base.unique_key_count,
      metric_raw_response_count: metricManifestCount,
      expected_metric_raw_response_count: EXPECTED_METRIC_RESPONSES,
      spot_count: geojson.features.length,
      month_count: MONTHS.length,
      date_scope_min: dateScope.data?.dateMin ?? null,
      date_scope_max: dateScope.data?.dateMax ?? null,
      boundary_hashes_match_baseline: !errors.some(error => error.includes('Boundary hash drift')),
      june_2026_anchor_values_match: !errors.some(error => error.includes('anchor mismatch')),
      all_scores_bounded: !errors.some(error => error.startsWith('Invalid ')),
    },
    errors,
    warnings,
    anomalies,
    caveats: [
      'The anonymous endpoints are used by the official website but are not published as a versioned API contract.',
      'EPSG:4326 is observed from the website implementation and remains pending written agency confirmation.',
      'The public change log says Gongyi Road was added on 2025-03-18 while valid observations begin in 2025-01; the effective boundary/data date requires agency confirmation.',
      'Telecom-derived measures are de-identified estimates and must not be interpreted as exact census counts or revenue.',
    ],
  };
}

function buildDataDictionary() {
  return [
    ['spot_code', 'integer', '官方景點代碼', 'GetSpots.spotCode', '11, 13, 21, 8043'],
    ['district_id', 'string', '網站內部穩定識別碼', '研究者對照', 'calligraphy, yizhong, fengjia, gongyi'],
    ['spot_name', 'string', '研究報告商圈名稱', '研究設計凍結', ''],
    ['official_name', 'string', '官方景點名稱', 'GetSpots.name', ''],
    ['official_full_name', 'string', '官方完整景點名稱', 'GetSpots.fullName', ''],
    ['month', 'YYYY-MM', '觀察月份', 'API start/end', `${STUDY_START}..${STUDY_END}`],
    ['visitors', 'number', '每日去重後人潮人次之月加總', 'GetPopulation.data.total', '> 0'],
    ['stay_minutes', 'number', '群體遊客平均連續停留分鐘', 'GetStayTime.data.stayMinutes', '> 0'],
    ['revisit_rate_pct', 'number', '同期間再次造訪同一景點之比例', 'GetRevisit.data', '0..100'],
    ['attraction_score', 'number', 'log1p 人次經 p01/p99 溫莎化及固定基準 min-max 分數', 'TCDPI Core v1', '0..100'],
    ['engagement_score', 'number', '停留時間經 p01/p99 溫莎化及固定基準 min-max 分數', 'TCDPI Core v1', '0..100'],
    ['loyalty_score', 'number', '回訪率經 p01/p99 溫莎化及固定基準 min-max 分數', 'TCDPI Core v1', '0..100'],
    ['tcdpi_score', 'number', '0.40×吸引力＋0.30×投入度＋0.30×黏著度', 'TCDPI Core v1', '0..100'],
    ['rank', 'integer', '同月份四區依 TCDPI 由高至低排序', 'TCDPI Core v1', '1..4'],
    ['data_status', 'string', '資料性質', '研究管線', 'official'],
    ['crs', 'string', 'WKT/GeoJSON 座標參考系統', '網站前端實作觀察', 'EPSG:4326; pending agency confirmation'],
    ['boundary_sha256', 'string', '原始 WKT UTF-8 文字 SHA-256', 'GetSpots.wkt', '64 lowercase hex characters'],
    ['population_response_id', 'string', '官方人流回應識別碼', 'GetPopulation.id', ''],
    ['stay_response_id', 'string', '官方停留回應識別碼', 'GetStayTime.id', ''],
    ['revisit_response_id', 'string', '官方回訪回應識別碼', 'GetRevisit.id', ''],
    ['population_raw_sha256', 'string', '人流原始 JSON SHA-256', 'source manifest', ''],
    ['stay_raw_sha256', 'string', '停留原始 JSON SHA-256', 'source manifest', ''],
    ['revisit_raw_sha256', 'string', '回訪原始 JSON SHA-256', 'source manifest', ''],
    ['fetched_at', 'ISO-8601', '本次資料集建立時間', '研究管線', 'UTC timestamp; manifest preserves per-file timestamps'],
    ['source_version', 'string', '來源快照版本', '研究管線', SOURCE_VERSION],
    ['method_version', 'string', '研究方法版本', '研究管線', METHOD_VERSION],
  ].map(([field, type, definition, source, validation]) => ({ field, type, definition, source, validation }));
}

function buildQualityMarkdown(report) {
  const checkRows = Object.entries(report.checks).map(([key, value]) => `| ${key} | ${String(value)} |`).join('\n');
  const errors = report.errors.length ? report.errors.map(item => `- ${item}`).join('\n') : '- 無';
  const warnings = report.warnings.length ? report.warnings.map(item => `- ${item}`).join('\n') : '- 無';
  const anomalies = report.anomalies.length
    ? report.anomalies.map(item => `- ${item.spot_code} ${item.month} ${item.metric}: ${item.change_pct}%`).join('\n')
    : '- 無達門檻異常';
  return `# 四商圈 ${MONTHS.length} 個月正式資料集品質報告

狀態：**${report.status}**  
資料粒度：功能性商業活動區－月份  
期間：${STUDY_START} 至 ${STUDY_END}

## 驗收結果

| 檢查 | 結果 |
|---|---:|
${checkRows}

## 錯誤

${errors}

## 警告

${warnings}

## 時序異常標記

${anomalies}

## 重要限制

${report.caveats.map(item => `- ${item}`).join('\n')}
`;
}

async function verifyManifestFiles(currentManifest) {
  const savedPath = join(METADATA_DIR, 'source-manifest.json');
  if (!(await exists(savedPath))) throw new Error('Missing metadata/source-manifest.json.');
  const savedManifest = JSON.parse(await readFile(savedPath, 'utf8'));
  const coverage = validateManifestCoverage(savedManifest, expectedRawPaths());
  if (!coverage.valid) throw new Error(`Manifest coverage invalid:\n${coverage.errors.join('\n')}`);
  const currentByPath = new Map(currentManifest.map(record => [record.raw_file, record.sha256]));
  for (const record of savedManifest) {
    const path = join(RAW_DIR, record.raw_file);
    if (!(await exists(path))) throw new Error(`Manifest file missing: ${record.raw_file}.`);
    const body = await readFile(path, 'utf8');
    if (sha256(body) !== record.sha256) throw new Error(`Manifest hash mismatch: ${record.raw_file}.`);
    if (currentByPath.has(record.raw_file) && currentByPath.get(record.raw_file) !== record.sha256) {
      throw new Error(`Current raw hash differs from manifest: ${record.raw_file}.`);
    }
  }
  return savedManifest;
}

async function main() {
  const verifyOnly = process.argv.includes('--verify-only');
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(METADATA_DIR, { recursive: true });
  await mkdir(PROCESSED_DIR, { recursive: true });

  const savedManifestPath = join(METADATA_DIR, 'source-manifest.json');
  const priorManifest = await exists(savedManifestPath)
    ? JSON.parse(await readFile(savedManifestPath, 'utf8'))
    : [];
  if (priorManifest.length > 0) {
    const priorCoverage = validateManifestCoverage(priorManifest, expectedRawPaths());
    if (!priorCoverage.valid) throw new Error(`Existing manifest coverage invalid:\n${priorCoverage.errors.join('\n')}`);
  }
  const priorManifestByPath = new Map(priorManifest.map(record => [record.raw_file, record]));
  const snapshot = await collectSnapshot({ verifyOnly, priorManifestByPath });
  const availabilityChecks = LEGACY_SNAPSHOT
    ? []
    : await collectAvailabilityChecks({ verifyOnly });
  if (!verifyOnly) {
    const currentCoverage = validateManifestCoverage(snapshot.manifest, expectedRawPaths());
    if (!currentCoverage.valid) throw new Error(`Current manifest coverage invalid:\n${currentCoverage.errors.join('\n')}`);
  }
  const priorMethodPath = join(METADATA_DIR, 'method-version.json');
  const datasetCreatedAt = await exists(priorMethodPath)
    ? JSON.parse(await readFile(priorMethodPath, 'utf8')).dataset_created_at
    : new Date().toISOString();
  const sourceRows = buildNormalizedRows({
    spots: snapshot.spots.data,
    formalSpots: FORMAL_SPOTS,
    months: MONTHS,
    responses: snapshot.responses,
    fetchedAt: datasetCreatedAt,
    sourceVersion: SOURCE_VERSION,
    methodVersion: METHOD_VERSION,
  });
  const rowsWithHashes = addRawHashes(sourceRows, snapshot.manifest);
  const scored = computeTcdpi(rowsWithHashes);
  const sensitivity = computeSensitivityAnalysis(scored.rows);
  const geojson = buildGeoJson(snapshot.spots);
  const quality = buildQualityReport({
    rows: rowsWithHashes,
    scoredRows: scored.rows,
    dateScope: snapshot.dateScope,
    manifest: snapshot.manifest,
    geojson,
  });
  if (!quality.ready) throw new Error(`Formal dataset failed validation:\n${quality.errors.join('\n')}`);

  if (verifyOnly) {
    const savedManifest = await verifyManifestFiles(snapshot.manifest);
    if (savedManifest.filter(record => record.raw_file.startsWith('metrics/')).length !== EXPECTED_METRIC_RESPONSES) {
      throw new Error(`Saved manifest does not contain ${EXPECTED_METRIC_RESPONSES} metric responses.`);
    }
    if (!LEGACY_SNAPSHOT) {
      const savedAvailability = JSON.parse(await readFile(join(METADATA_DIR, 'availability-checks.json'), 'utf8'));
      for (const record of savedAvailability) {
        const body = await readFile(join(RAW_DIR, record.raw_file), 'utf8');
        if (sha256(body) !== record.sha256) throw new Error(`Availability raw hash mismatch: ${record.raw_file}.`);
      }
      if (savedAvailability.length !== 24) throw new Error(`Expected 24 availability records, found ${savedAvailability.length}.`);
    }
    const expectedDataset = {
      metadata: {
        dataset_version: DATASET_VERSION,
        method_version: METHOD_VERSION,
        source_snapshot: SNAPSHOT_DATE,
        created_at: datasetCreatedAt,
        period_start: STUDY_START,
        period_end: STUDY_END,
        row_count: scored.rows.length,
        is_demo: false,
      },
      rows: scored.rows,
    };
    const expectedDatasetJson = `${JSON.stringify(expectedDataset, null, 2)}\n`;
    const rowColumns = Object.keys(scored.rows[0]);
    assertArtifactMatches(
      'processed dataset JSON',
      await readFile(join(PROCESSED_DIR, DATASET_JSON), 'utf8'),
      expectedDatasetJson,
    );
    assertArtifactMatches(
      'processed dataset CSV',
      await readFile(join(PROCESSED_DIR, DATASET_CSV), 'utf8'),
      csvStringify(scored.rows, rowColumns),
    );
    assertArtifactMatches(
      'district GeoJSON',
      await readFile(join(PROCESSED_DIR, GEOJSON_FILE), 'utf8'),
      `${JSON.stringify(geojson, null, 2)}\n`,
    );
    assertArtifactMatches(
      'ranking sensitivity JSON',
      await readFile(join(PROCESSED_DIR, SENSITIVITY_JSON), 'utf8'),
      `${JSON.stringify(sensitivity, null, 2)}\n`,
    );
    assertArtifactMatches(
      'ranking sensitivity CSV',
      await readFile(join(PROCESSED_DIR, SENSITIVITY_CSV), 'utf8'),
      csvStringify(sensitivity.rows, Object.keys(sensitivity.rows[0])),
    );
    const savedQuality = JSON.parse(await readFile(join(PROCESSED_DIR, QUALITY_JSON), 'utf8'));
    if (!savedQuality.ready) throw new Error('Saved quality report is not release-ready.');
    console.log(JSON.stringify({ mode: 'verify-only', status: quality.status, checks: quality.checks }, null, 2));
    return;
  }

  const methodVersion = {
    dataset_version: DATASET_VERSION,
    dataset_created_at: datasetCreatedAt,
    source_snapshot: SNAPSHOT_DATE,
    availability_checks: availabilityChecks.map(({ raw_file, classification, value, message }) => ({ raw_file, classification, value, message })),
    excluded_periods: ['2026-09', '2026-10'],
    source_system: '臺中市主要遊憩據點遊客行為資訊網',
    source_api_contract: 'anonymous internal website endpoints; not formally versioned',
    source_date_scope: snapshot.dateScope.data,
    study_period: { start: STUDY_START, end: STUDY_END, months: MONTHS.length },
    spot_codes: FORMAL_SPOTS.map(spot => spot.spotCode),
    grain: 'functional-commercial-area-month',
    crs: { value: 'EPSG:4326', status: 'observed-in-frontend-pending-agency-confirmation' },
    boundary_hashes: Object.fromEntries(geojson.features.map(feature => [feature.properties.spot_code, feature.properties.boundary_sha256])),
    endpoints: Object.fromEntries(METRICS.map(metric => [metric.id, `${BASE_URL}${metric.endpoint}`])),
    processing: {
      visitors_transform: 'log1p',
      winsorization: `linear-interpolated p01/p99 over all ${FORMAL_SPOTS.length * MONTHS.length} baseline rows, separately per metric`,
      scaling: 'fixed-baseline min-max to 0-100; clipped to 0-100; constant range maps to 50',
      baseline: `all ${FORMAL_SPOTS.length * MONTHS.length} spot-month rows from ${STUDY_START} through ${STUDY_END}`,
      weights: { attraction: 0.4, engagement: 0.3, loyalty: 0.3 },
      rank: 'descending TCDPI score; spot_code ascending deterministic tie-break',
    },
    baseline_parameters: scored.baseline,
    sensitivity_analysis: {
      equal_weights: { attraction: 1 / 3, engagement: 1 / 3, loyalty: 1 / 3 },
      entropy_weights: sensitivity.entropy_weights,
      perturbation_rule: 'Each base weight is varied by ±0.10; the other two weights are proportionally rescaled to keep the sum at 1.',
      agreement_metrics: ['Spearman rank correlation', 'Kendall rank correlation'],
    },
    known_method_questions_for_agency: [
      'Visitor sample expansion and inclusion/exclusion rules',
      'Minimum/maximum dwell thresholds and session stitching',
      'Exact revisit denominator and meaning of same period',
      'Suppression, rounding, revision and backfill rules',
      'WKT purpose, CRS and effective dates',
      'Vendor or estimation-method changes during the study period',
    ],
  };
  const dataset = {
    metadata: {
      dataset_version: methodVersion.dataset_version,
      method_version: METHOD_VERSION,
      source_snapshot: SNAPSHOT_DATE,
      created_at: datasetCreatedAt,
      period_start: STUDY_START,
      period_end: STUDY_END,
      row_count: scored.rows.length,
      is_demo: false,
    },
    rows: scored.rows,
  };
  const rowColumns = Object.keys(scored.rows[0]);
  const manifestColumns = Object.keys(snapshot.manifest[0]);
  const dictionary = buildDataDictionary();

  await atomicWrite(join(METADATA_DIR, 'source-manifest.json'), `${JSON.stringify(snapshot.manifest, null, 2)}\n`);
  await atomicWrite(join(METADATA_DIR, 'source-manifest.csv'), csvStringify(snapshot.manifest, manifestColumns));
  await atomicWrite(join(METADATA_DIR, 'data-dictionary.csv'), csvStringify(dictionary, ['field', 'type', 'definition', 'source', 'validation']));
  await atomicWrite(join(METADATA_DIR, 'method-version.json'), `${JSON.stringify(methodVersion, null, 2)}\n`);
  if (!LEGACY_SNAPSHOT) {
    await atomicWrite(join(METADATA_DIR, 'availability-checks.json'), `${JSON.stringify(availabilityChecks, null, 2)}\n`);
    await atomicWrite(join(METADATA_DIR, 'availability-checks.csv'), csvStringify(availabilityChecks, Object.keys(availabilityChecks[0])));
  }
  await atomicWrite(join(METADATA_DIR, 'source-documents.md'), `# 官方來源文件快照\n\n${DOCUMENTS.map(([id, route, label]) => {
    const record = snapshot.manifest.find(item => item.raw_file === `pages/${id}.html`);
    return `- [${label}](${BASE_URL}${route}) — 檔案：\`raw/${SNAPSHOT_DATE}/pages/${id}.html\`；SHA-256：\`${record?.sha256 ?? 'not-recorded'}\``;
  }).join('\n')}\n\n授權解讀：網站條款允許在標示來源下利用屬於著作權保護範圍的資料；商標、標誌與另有權利人的素材不當然包含。研究發表前仍應保留本快照並確認引用方式。\n`);
  await atomicWrite(join(PROCESSED_DIR, DATASET_JSON), `${JSON.stringify(dataset, null, 2)}\n`);
  await atomicWrite(join(PROCESSED_DIR, DATASET_CSV), csvStringify(scored.rows, rowColumns));
  await atomicWrite(join(PROCESSED_DIR, GEOJSON_FILE), `${JSON.stringify(geojson, null, 2)}\n`);
  await atomicWrite(join(PROCESSED_DIR, SENSITIVITY_JSON), `${JSON.stringify(sensitivity, null, 2)}\n`);
  await atomicWrite(join(PROCESSED_DIR, SENSITIVITY_CSV), csvStringify(sensitivity.rows, Object.keys(sensitivity.rows[0])));
  await atomicWrite(join(PROCESSED_DIR, QUALITY_JSON), `${JSON.stringify(quality, null, 2)}\n`);
  await atomicWrite(join(PROCESSED_DIR, QUALITY_MD), buildQualityMarkdown(quality));

  console.log(JSON.stringify({
    mode: 'build',
    status: quality.status,
    output_root: resolve(SCRIPT_DIR),
    checks: quality.checks,
  }, null, 2));
}

await main();
