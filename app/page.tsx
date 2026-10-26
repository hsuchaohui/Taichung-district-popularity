'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Comparison } from '../components/Comparison';
import { DistrictDetail } from '../components/DistrictDetail';
import { DistrictLocation } from '../components/DistrictLocation';
import { Hero } from '../components/Hero';
import { Methodology } from '../components/Methodology';
import { Ranking } from '../components/Ranking';
import { IndexExplanation } from '../components/IndexExplanation';
import { districtPhotoById } from '../data/districts';
import { safelyLoadStudyDataset, type StudyDatasetLoadResult } from '../lib/study-data';
import type { StudyDataset } from '../lib/types';
import { getAvailableMonths, getComparisonRows, getMonthRanking } from '../lib/selectors';

function SiteFooter({ updatedAt }: { updatedAt?: string }) {
  return (
    <footer className="site-footer">
      <div>
        <p>臺中商圈熱門指數｜專題研究團隊</p>
        <p>
          {updatedAt ? `資料擷取：${new Date(updatedAt).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}｜` : ''}
          官方電信推估資料整理；最新完整月份為 2026 年 8 月
        </p>
        <p>圖片來源與授權標示見各圖片說明。</p>
      </div>
      <nav aria-label="法律資訊">
        <Link href="/terms">使用條款</Link>
        <Link href="/privacy">隱私權說明</Link>
      </nav>
    </footer>
  );
}

function DataPage({ studyData }: { studyData: StudyDataset }) {
  const data = studyData.core;
  const months = useMemo(() => getAvailableMonths(data), [data]);
  const initialRanking = useMemo(
    () => getMonthRanking(data, data.metadata.periodEnd),
    [data],
  );
  const [selectedMonth, setSelectedMonth] = useState(data.metadata.periodEnd);
  const [selectedDistrictId, setSelectedDistrictId] = useState(
    initialRanking[0]?.districtId ?? data.districts[0]?.id ?? '',
  );
  const [selectedStorePlaceId, setSelectedStorePlaceId] = useState<string>();
  const [comparisonIds, setComparisonIds] = useState(
    data.districts.map((district) => district.id),
  );
  const [comparisonMessage, setComparisonMessage] = useState('');

  const ranking = useMemo(
    () => getMonthRanking(data, selectedMonth),
    [data, selectedMonth],
  );
  const selectedDistrict = data.districts.find(
    (district) => district.id === selectedDistrictId,
  );
  const selectedMetric = ranking.find(
    (row) => row.districtId === selectedDistrictId,
  );
  const comparisonRows = useMemo(
    () => comparisonIds.length >= 2 && comparisonIds.length <= 4
      ? getComparisonRows(data, comparisonIds)
      : [],
    [comparisonIds, data],
  );

  function handleMonthChange(month: string) {
    setSelectedMonth(month);
    setSelectedStorePlaceId(undefined);
    const firstDistrict = getMonthRanking(data, month)[0];
    if (firstDistrict) {
      setSelectedDistrictId(firstDistrict.districtId);
    }
  }

  const handleDistrictSelect = useCallback((districtId: string) => {
    setSelectedDistrictId(districtId);
    setSelectedStorePlaceId(undefined);
  }, []);

  function handleComparisonChange(districtId: string, selected: boolean) {
    const nextIds = selected
      ? comparisonIds.includes(districtId)
        ? comparisonIds
        : [...comparisonIds, districtId]
      : comparisonIds.filter((id) => id !== districtId);

    if (nextIds.length < 2) {
      setComparisonMessage('至少保留兩個商圈進行比較');
      return;
    }
    if (nextIds.length > 4) {
      setComparisonMessage('最多選擇四個商圈進行比較');
      return;
    }

    setComparisonMessage('');
    setComparisonIds(nextIds);
  }

  return (
    <>
      <Hero photo={districtPhotoById.fengjia} monthCount={months.length} />
      <main>
        <div className="research-layout">
          <Ranking
            districts={data.districts}
            months={months}
            ranking={ranking}
            selectedMonth={selectedMonth}
            selectedDistrictId={selectedDistrictId}
            onMonthChange={handleMonthChange}
            onDistrictSelect={handleDistrictSelect}
            dataLabel="正式資料"
          />
          {selectedDistrict && selectedMetric ? (
            <DistrictDetail
              district={selectedDistrict}
              metric={selectedMetric}
              comparisonSelected={comparisonIds.includes(selectedDistrict.id)}
              comparisonSelectionLocked={
                comparisonIds.includes(selectedDistrict.id) && comparisonIds.length <= 2
              }
              onComparisonChange={(selected) =>
                handleComparisonChange(selectedDistrict.id, selected)
              }
              selectedStorePlaceId={selectedStorePlaceId}
              onStoreSelect={setSelectedStorePlaceId}
              dataLabel="正式資料"
              showComponentBreakdown
            />
          ) : null}
        </div>
        <Comparison
          districts={data.districts}
          comparisonIds={comparisonIds}
          comparisonRows={comparisonRows}
          selectedMonth={selectedMonth}
          selectionMessage={comparisonMessage}
          onComparisonChange={handleComparisonChange}
          dataLabel="正式資料"
          showComponentComparison
        />
        <DistrictLocation
          districts={data.districts}
          selectedDistrictId={selectedDistrictId}
          selectedStorePlaceId={selectedStorePlaceId}
          onDistrictSelect={handleDistrictSelect}
          onStoreSelect={setSelectedStorePlaceId}
        />
        <IndexExplanation studyData={studyData} month={selectedMonth} />
        <Methodology studyData={studyData} />
      </main>
      <SiteFooter updatedAt={data.metadata.updatedAt} />
    </>
  );
}

export function PageShell({ datasetResult }: { datasetResult: StudyDatasetLoadResult }) {
  if (datasetResult.ok) {
    return <DataPage studyData={datasetResult.data} />;
  }

  return (
    <>
      <Hero photo={districtPhotoById.fengjia} badgeText="正式研究資料暫時無法載入" />
      <main>
        <section className="research-layout" aria-labelledby="dataset-error-title">
          <div className="ranking-panel" role="alert">
            <p className="eyebrow">DATA STATUS</p>
            <h2 id="dataset-error-title">正式資料暫時無法讀取</h2>
            <p>排名、商圈詳情、比較與位置資料目前無法顯示。</p>
          </div>
        </section>
        <Methodology />
      </main>
      <SiteFooter />
    </>
  );
}

export default function Page() {
  return <PageShell datasetResult={safelyLoadStudyDataset()} />;
}
