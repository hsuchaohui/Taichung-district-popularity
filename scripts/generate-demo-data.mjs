import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const districts = [
  ['fengjia', '逢甲商圈', 680000, 220, 72],
  ['yizhong', '一中商圈', 930000, 165, 81],
  ['calligraphy', '草悟道', 510000, 158, 78],
  ['gongyi', '公益路商圈', 1320000, 176, 84]
];

const districtDetails = {
  fengjia: {
    shortName: '逢甲',
    location: { lat: 24.179, lng: 120.6466, label: '台中市西屯區文華路' },
  },
  yizhong: {
    shortName: '一中',
    location: { lat: 24.1493, lng: 120.6853, label: '台中市北區一中街' },
  },
  calligraphy: {
    shortName: '草悟道',
    location: { lat: 24.1507, lng: 120.6638, label: '台中市西區中興街' },
  },
  gongyi: {
    shortName: '公益路',
    location: { lat: 24.1517, lng: 120.6564, label: '台中市西區公益路' },
  },
};

const roundOne = value => Math.round(value * 10) / 10;
const clampScore = value => Math.max(0, Math.min(100, roundOne(value)));

function generateMonths() {
  const months = [];
  for (let year = 2025, month = 1; year < 2026 || month <= 6; month += 1) {
    if (month === 13) {
      year += 1;
      month = 1;
    }
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return months;
}

function makeMetric([districtId, , baseVisitors, baseStay, baseRevisit], districtIndex, month, monthIndex) {
  const seasonality = 1 + 0.08 * Math.sin(monthIndex * Math.PI / 6);
  const offset = districtIndex - 1.5;
  const visitors = Math.round(baseVisitors * seasonality * (1 + offset * 0.012));
  const stayMinutes = Math.round(baseStay + offset * 3 + 7 * Math.sin((monthIndex + districtIndex) * Math.PI / 6));
  const revisitRate = clampScore(baseRevisit + offset * 0.8 + 2.2 * Math.cos((monthIndex + districtIndex) * Math.PI / 6));
  const attractionScore = clampScore(55 + 11 * Math.log10(visitors / 100000) + districtIndex * 1.5);
  const engagementScore = clampScore(42 + stayMinutes * 0.22 + offset * 0.7);
  const loyaltyScore = clampScore(revisitRate + offset * 0.5);
  const popularityScore = roundOne(
    0.4 * attractionScore + 0.3 * engagementScore + 0.3 * loyaltyScore,
  );

  return {
    districtId,
    month,
    visitors,
    stayMinutes,
    revisitRate,
    attractionScore,
    engagementScore,
    loyaltyScore,
    popularityScore,
    rank: null,
    rankChange: null,
    dataStatus: 'demo',
  };
}

const districtRecords = districts.map(([id, name]) => ({
  id,
  name,
  shortName: districtDetails[id].shortName,
  location: districtDetails[id].location,
}));

const monthlyMetrics = [];
for (const [monthIndex, month] of generateMonths().entries()) {
  const rows = districts.map((district, districtIndex) =>
    makeMetric(district, districtIndex, month, monthIndex));
  rows.sort((a, b) => b.popularityScore - a.popularityScore || a.districtId.localeCompare(b.districtId));
  rows.forEach((row, index) => {
    row.rank = index + 1;
    const previous = monthlyMetrics.find(candidate =>
      candidate.districtId === row.districtId && candidate.month === generateMonths()[monthIndex - 1]);
    row.rankChange = previous ? previous.rank - row.rank : null;
  });
  monthlyMetrics.push(...rows);
}

const dataset = {
  metadata: {
    updatedAt: '2026-08-18',
    periodStart: '2025-01',
    periodEnd: '2026-06',
    isDemo: true,
  },
  districts: districtRecords,
  monthlyMetrics,
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, '../data/demo.json');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
