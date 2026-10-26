import { getAnomaliesForMonth, getSensitivityForMonth } from '../lib/study-data';
import type { StudyDataset } from '../lib/types';

function formatMonth(month: string): string {
  const [year, numericMonth] = month.split('-');
  return `${year}年${Number(numericMonth)}月`;
}

function formatRank(rank: number): string {
  return `第 ${rank} 名`;
}

function formatRange(minimum: number, maximum: number): string {
  return minimum === maximum ? formatRank(minimum) : `第 ${minimum}–${maximum} 名`;
}

export function IndexExplanation({
  studyData,
  month,
}: {
  studyData: StudyDataset;
  month: string;
}) {
  const rows = getSensitivityForMonth(studyData, month);
  const anomalies = getAnomaliesForMonth(studyData, month);
  const districtById = new Map(
    studyData.core.districts.map((district) => [district.id, district]),
  );

  if (rows.length !== studyData.core.districts.length) {
    return (
      <section className="explanation-section" aria-labelledby="explanation-title">
        <h2 id="explanation-title">權重與排名敏感度解釋</h2>
        <p role="status">本月權重敏感度資料暫時無法取得，請以指數排名與方法說明為準。</p>
      </section>
    );
  }

  const entropy = studyData.entropyWeights;
  const sensitiveCount = rows.filter(
    (row) => row.perturbationRankMin !== row.perturbationRankMax,
  ).length;

  return (
    <section className="explanation-section explanation-slim" aria-labelledby="explanation-title">
      <div className="explanation-compact">
        <h2 id="explanation-title">權重與排名敏感度解釋</h2>
        <p>
          {formatMonth(month)}：{rows.length - sensitiveCount} 個商圈名次在權重小幅調整後不變，
          {sensitiveCount} 個可能改變。
        </p>
      </div>

      <details className="explanation-details">
        <summary>詳細排名</summary>
        <p className="explanation-weights">
          主要權重 吸引力 40%｜投入度 30%｜黏著度 30%；等權重各約 33.33%；熵權重 吸引力 {(entropy.attraction * 100).toFixed(2)}%｜
          投入度 {(entropy.engagement * 100).toFixed(2)}%｜黏著度 {(entropy.loyalty * 100).toFixed(2)}%。
          「穩健」代表權重正負 10 個百分點調整後名次不變，「敏感」代表可能落在不同名次。
        </p>
        <div className="weight-table-wrap">
          <table className="weight-table">
            <caption>{formatMonth(month)}替代權重排名</caption>
            <thead>
              <tr>
                <th scope="col">商圈</th>
                <th scope="col">主要分數</th>
                <th scope="col">主要權重</th>
                <th scope="col">等權重</th>
                <th scope="col">熵權重</th>
                <th scope="col">±10pp 排名範圍</th>
                <th scope="col">判定</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const district = districtById.get(row.districtId);
                const robust = row.perturbationRankMin === row.perturbationRankMax;
                return (
                  <tr key={row.districtId}>
                    <th scope="row">{district?.name ?? row.districtId}</th>
                    <td>{row.baseScore.toFixed(4)} 分</td>
                    <td>{formatRank(row.baseRank)}</td>
                    <td>{formatRank(row.equalRank)}</td>
                    <td>{formatRank(row.entropyRank)}</td>
                    <td>{formatRange(row.perturbationRankMin, row.perturbationRankMax)}</td>
                    <td><span className="robustness-status">{robust ? '穩健' : '敏感'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      <div className="quality-notice" role="status" aria-label="資料品質提醒">
        {anomalies.length === 0 ? (
          <p>本月未觸發既定異常規則；這不代表資料沒有其他限制。</p>
        ) : (
          anomalies.map((anomaly) => {
            const district = districtById.get(anomaly.districtId);
            const direction = anomaly.changePct >= 0 ? '增加' : '減少';
            return (
              <p key={`${anomaly.districtId}:${anomaly.metric}`}>
                {district?.name ?? anomaly.districtId}
                {anomaly.metric === 'visitors' ? '到訪人次' : anomaly.metric}
                較前月{direction} {Math.abs(anomaly.changePct).toFixed(2)}%。
                此為異常提醒，不能單獨證明持續成長或衰退。
              </p>
            );
          })
        )}
      </div>
    </section>
  );
}
