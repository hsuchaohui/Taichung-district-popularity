'use client';

import type { DistrictPhotoConfig } from '../data/districts';
import { DistrictPhoto } from './DistrictPhoto';

interface HeroProps {
  photo: DistrictPhotoConfig;
  badgeText?: string;
  googlePhotosEnabled?: boolean;
  monthCount?: number;
}

export function Hero({
  photo,
  badgeText = '正式官方資料｜研究估算指數',
  googlePhotosEnabled = true,
  monthCount = 20,
}: HeroProps) {
  const summaries = [
    ['4', '個核心商圈'],
    [String(monthCount), '個共同月份'],
    ['3', '個指數構面'],
  ] as const;

  return (
    <header className="hero">
      <nav className="site-nav" aria-label="主要導覽">
        <a className="wordmark" href="#top" aria-label="臺中商圈熱門指數首頁">
          TAICHUNG <span>INDEX</span>
        </a>
        <div className="site-nav-links">
          <a href="#ranking">本月排名</a>
          <a href="#comparison">商圈比較</a>
          <a href="#location">位置概覽</a>
          <a href="#methodology">研究方法</a>
        </div>
        <span className="demo-badge">{badgeText}</span>
      </nav>

      <div className="hero-grid">
        <div className="hero-copy" id="top">
          <p className="eyebrow">TAICHUNG BUSINESS DISTRICT INDEX · 2025—2026</p>
          <h1>看見人潮之外，<br />商圈為何被留下。</h1>
          <p className="hero-intro">
            從到訪規模、停留互動與回訪黏著，建立一套可拆解、可比較的臺中商圈熱門指數。
          </p>
        </div>
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
          className="hero-photo"
        />
      </div>

      <dl className="hero-summary" aria-label="研究範圍摘要">
        {summaries.map(([value, label]) => (
          <div key={label}>
            <dt>研究涵蓋</dt>
            <dd>{value} {label}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
