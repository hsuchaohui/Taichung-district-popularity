'use client';

import { formatMetric } from '../lib/selectors';
import type { District, MonthlyMetric } from '../lib/types';
import { getDistrictPhotoConfig } from '../data/districts';
import { DistrictPhoto } from './DistrictPhoto';
import { RepresentativeStores } from './RepresentativeStores';

interface DistrictDetailProps {
  district: District;
  metric: MonthlyMetric;
  comparisonSelected: boolean;
  comparisonSelectionLocked: boolean;
  onComparisonChange: (selected: boolean) => void;
  selectedStorePlaceId?: string;
  onStoreSelect: (placeId: string) => void;
  dataLabel?: string;
  googlePhotosEnabled?: boolean;
  showComponentBreakdown?: boolean;
  showRepresentativeStores?: boolean;
}

const componentLabels = [
  ['attractionScore', '吸引力', '到訪規模'],
  ['engagementScore', '互動力', '停留深度'],
  ['loyaltyScore', '黏著力', '回訪意願'],
] as const;

export function DistrictDetail({
  district,
  metric,
  comparisonSelected,
  comparisonSelectionLocked,
  onComparisonChange,
  selectedStorePlaceId,
  onStoreSelect,
  dataLabel = '示範資料',
  googlePhotosEnabled = true,
  showComponentBreakdown = true,
  showRepresentativeStores = true,
}: DistrictDetailProps) {
  const photo = getDistrictPhotoConfig(district.id);
  const metrics = [
    ['到訪人次', formatMetric(metric.visitors, '人')],
    ['平均停留', formatMetric(metric.stayMinutes, '分鐘')],
    ['回訪率', formatMetric(metric.revisitRate, '%')],
  ] as const;

  return (
    <section className="detail-panel" aria-labelledby="detail-title">
      <div className="detail-header">
        <div>
          <p className="eyebrow">DISTRICT DETAIL · {dataLabel}</p>
          <h2 id="detail-title">{district.name}指標詳情</h2>
          <p>{district.location.label}</p>
        </div>
        <label className="comparison-control">
          <input
            type="checkbox"
            checked={comparisonSelected}
            disabled={comparisonSelectionLocked}
            onChange={(event) => onComparisonChange(event.target.checked)}
          />
          加入跨商圈比較
        </label>
      </div>

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
          className="detail-photo"
        />
      ) : null}

      <dl className="metric-grid">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {showComponentBreakdown ? <div className="component-breakdown">
        <div className="breakdown-heading">
          <h3>指數構面貢獻</h3>
          <span>0—100 分</span>
        </div>
        {componentLabels.map(([field, label, description]) => {
          const value = metric[field];
          const width = value === null ? 0 : Math.max(0, Math.min(100, value));
          return (
            <div className="component-row" key={field}>
              <div className="component-label">
                <strong>{label}</strong>
                <span>{description}</span>
              </div>
              <div className="component-value">
                <span
                  className="component-track"
                  role="progressbar"
                  aria-label={`${label}分數`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={value ?? undefined}
                  aria-valuetext={formatMetric(value, '分')}
                >
                  <span className="component-bar" style={{ width: `${width}%` }} />
                </span>
                <strong>{formatMetric(value, '分')}</strong>
              </div>
            </div>
          );
        })}
      </div> : null}

      {showRepresentativeStores ? <RepresentativeStores
        districtId={district.id}
        selectedPlaceId={selectedStorePlaceId}
        onStoreSelect={onStoreSelect}
      /> : null}
    </section>
  );
}
