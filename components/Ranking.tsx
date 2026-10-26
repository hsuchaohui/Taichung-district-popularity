'use client';

import { formatMetric } from '../lib/selectors';
import type { District, MonthlyMetric } from '../lib/types';
import { getDistrictPhotoConfig } from '../data/districts';
import { DistrictPhoto } from './DistrictPhoto';

interface RankingProps {
  districts: District[];
  months: string[];
  ranking: MonthlyMetric[];
  selectedMonth: string;
  selectedDistrictId: string;
  onMonthChange: (month: string) => void;
  onDistrictSelect: (districtId: string) => void;
  dataLabel?: string;
  googlePhotosEnabled?: boolean;
}

function formatMonth(month: string): string {
  const [year, numericMonth] = month.split('-');
  return `${year}年${Number(numericMonth)}月`;
}

function formatMovement(row: MonthlyMetric): string {
  if (row.dataStatus === 'missing' || row.rank === null) return '本月資料尚未提供';
  if (row.rankChange === null) return '無前月可比較';
  if (row.rankChange === 0) return '— 持平';
  return row.rankChange > 0
    ? `↑ 上升 ${row.rankChange} 名`
    : `↓ 下降 ${Math.abs(row.rankChange)} 名`;
}

export function Ranking({
  districts,
  months,
  ranking,
  selectedMonth,
  selectedDistrictId,
  onMonthChange,
  onDistrictSelect,
  dataLabel = '示範資料',
  googlePhotosEnabled = true,
}: RankingProps) {
  const districtsById = new Map(districts.map((district) => [district.id, district]));

  return (
    <section id="ranking" className="ranking-panel" aria-labelledby="ranking-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MONTHLY RANKING</p>
          <h2 id="ranking-title">{formatMonth(selectedMonth)}熱門排行榜</h2>
        </div>
        <label className="month-control">
          <span>資料月份</span>
          <select
            value={selectedMonth}
            onChange={(event) => onMonthChange(event.target.value)}
          >
            {months.map((month) => (
              <option value={month} key={month}>{formatMonth(month)}</option>
            ))}
          </select>
        </label>
      </div>

      <ol className="ranking-list">
        {ranking.map((row) => {
          const district = districtsById.get(row.districtId);
          if (!district) return null;
          const selected = row.districtId === selectedDistrictId;
          const photo = getDistrictPhotoConfig(row.districtId);

          return (
            <li key={row.districtId} className="ranking-list-item">
              {photo ? (
                <DistrictPhoto
                  districtId={photo.districtId}
                  placeId={photo.googlePlaceId}
                  alt={photo.alt}
                  fallbackSrc={photo.fallback.src}
                  fallbackCredit={photo.fallback.author}
                  fallbackCreditUrl={photo.fallback.filePageUrl}
                  fallbackLicense={photo.fallback.license}
                  fallbackLicenseUrl={photo.fallback.licenseUrl}
                  googleEnabled={googlePhotosEnabled}
                  className="ranking-photo"
                />
              ) : null}
              <button
                type="button"
                className="ranking-row"
                aria-label={`查看${district.name}`}
                aria-pressed={selected}
                onClick={() => onDistrictSelect(row.districtId)}
              >
                <span className={row.rank === null ? 'rank-number rank-number-missing' : 'rank-number'}>
                  {row.rank === null ? '本月資料尚未提供' : row.rank}
                </span>
                <span className="district-name">
                  <strong>{district.name}</strong>
                  <small>{district.location.label}</small>
                  {selected ? (
                    <span className="selection-status">✓ 目前選取</span>
                  ) : null}
                </span>
                <span className="rank-movement">{formatMovement(row)}</span>
                <span className="popularity-score">
                  <strong>{formatMetric(row.popularityScore, '分')}</strong>
                  <small>熱門指數 · {dataLabel}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
