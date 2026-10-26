'use client';

import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMetric } from '../lib/selectors';
import type { District, MonthlyMetric } from '../lib/types';

interface ComparisonProps {
  districts: District[];
  comparisonIds: string[];
  comparisonRows: MonthlyMetric[];
  selectedMonth: string;
  selectionMessage: string;
  onComparisonChange: (districtId: string, selected: boolean) => void;
  dataLabel?: string;
  showComponentComparison?: boolean;
}

const defaultSeriesStyle = { color: '#168477', dash: undefined } as const;
const seriesStyleByDistrictId = {
  fengjia: defaultSeriesStyle,
  yizhong: { color: '#c65a32', dash: '8 4' },
  calligraphy: { color: '#6b5b95', dash: '3 3' },
  gongyi: { color: '#286a8a', dash: '12 4 2 4' },
} as const;

export function getSeriesStyles(districtIds: string[]) {
  return new Map(
    districtIds.map((districtId) => [
      districtId,
      seriesStyleByDistrictId[districtId as keyof typeof seriesStyleByDistrictId]
        ?? defaultSeriesStyle,
    ]),
  );
}

const componentGroups = [
  ['attractionScore', '吸引力'],
  ['engagementScore', '投入度'],
  ['loyaltyScore', '黏著度'],
] as const;

function formatMonth(month: string) {
  const [year, number] = month.split('-');
  return `${year}/${Number(number)}`;
}

function formatScore(value: number | null) {
  return value === null ? formatMetric(null, '分') : `${value.toFixed(1)} 分`;
}

export function Comparison({
  districts,
  comparisonIds,
  comparisonRows,
  selectedMonth,
  selectionMessage,
  onComparisonChange,
  dataLabel = '示範資料',
  showComponentComparison = true,
}: ComparisonProps) {
  const selectedDistricts = districts.filter((district) =>
    comparisonIds.includes(district.id),
  );
  const selectedSeriesStyles = getSeriesStyles(
    selectedDistricts.map((district) => district.id),
  );
  const districtById = new Map(districts.map((district) => [district.id, district]));
  const months = [...new Set(comparisonRows.map((row) => row.month))].sort();
  const chartData = months.map((month) => {
    const point: Record<string, string | number | null> = { month };
    for (const row of comparisonRows) {
      if (row.month === month) point[row.districtId] = row.popularityScore;
    }
    return point;
  });
  const currentRows = comparisonRows.filter((row) => row.month === selectedMonth);

  return (
    <section id="comparison" className="comparison-section" aria-labelledby="comparison-title">
      <div className="section-intro">
        <div>
          <p className="eyebrow">CROSS-DISTRICT COMPARISON</p>
          <h2 id="comparison-title">
            {showComponentComparison ? '多商圈趨勢與構面比較' : '多商圈趨勢比較'}
          </h2>
        </div>
        <p>選擇 2–4 個商圈，觀察 {months.length} 個共同月份的熱門指數變化。</p>
      </div>

      <fieldset className="comparison-picker">
        <legend>選擇比較商圈</legend>
        <div className="comparison-options">
          {districts.map((district) => (
            <label key={district.id}>
              <input
                type="checkbox"
                checked={comparisonIds.includes(district.id)}
                onChange={(event) =>
                  onComparisonChange(district.id, event.target.checked)
                }
              />
              加入比較：{district.name}
            </label>
          ))}
        </div>
        <p className="selection-guidance" aria-live="polite">
          {selectionMessage || `目前選取 ${comparisonIds.length} 個商圈`}
        </p>
      </fieldset>

      <div className="trend-layout">
        <figure className="trend-figure" aria-labelledby="trend-title">
          <figcaption id="trend-title">{months.length} 個月熱門指數趨勢（{dataLabel}）</figcaption>
          <div
            className="trend-chart"
            role="img"
            aria-label={`${selectedDistricts.map((district) => district.name).join('、')}的${months.length}個月熱門指數折線圖`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} accessibilityLayer margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
                <XAxis dataKey="month" tickFormatter={formatMonth} minTickGap={28} />
                <YAxis domain={[0, 100]} width={38} />
                <Tooltip
                  labelFormatter={(label) => formatMonth(String(label))}
                  formatter={(value, name) => [
                    formatScore(typeof value === 'number' ? value : null),
                    districtById.get(String(name))?.name ?? String(name),
                  ]}
                />
                <Legend formatter={(id) => districtById.get(String(id))?.name ?? String(id)} />
                {selectedDistricts.map((district) => {
                  const style = selectedSeriesStyles.get(district.id) ?? defaultSeriesStyle;
                  return (
                    <Line
                      key={district.id}
                      dataKey={district.id}
                      name={district.id}
                      type="monotone"
                      stroke={style.color}
                      strokeDasharray={style.dash}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>

        <div className="trend-table-wrap">
          <table className="trend-table">
            <caption>熱門指數趨勢文字資料（{dataLabel}）</caption>
            <thead>
              <tr>
                <th scope="col">月份</th>
                {selectedDistricts.map((district) => (
                  <th scope="col" key={district.id}>{district.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month}>
                  <th scope="row">{formatMonth(month)}</th>
                  {selectedDistricts.map((district) => {
                    const row = comparisonRows.find(
                      (candidate) => candidate.month === month && candidate.districtId === district.id,
                    );
                    return <td key={district.id}>{formatScore(row?.popularityScore ?? null)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showComponentComparison ? <div className="component-comparison" aria-labelledby="component-comparison-title">
        <div className="breakdown-heading">
          <h3 id="component-comparison-title">
            {formatMonth(selectedMonth)} 構面比較（{dataLabel}）
          </h3>
          <span>0—100 分</span>
        </div>
        {componentGroups.map(([field, label]) => (
          <section className="component-group" aria-labelledby={`comparison-${field}`} key={field}>
            <h4 id={`comparison-${field}`}>{label}</h4>
            <div className="component-districts">
              {selectedDistricts.map((district) => {
                const value = currentRows.find((row) => row.districtId === district.id)?.[field] ?? null;
                return (
                  <div className="component-district-row" key={district.id}>
                    <span>{district.name}</span>
                    <span className="component-track" aria-hidden="true">
                      <span className="component-bar" style={{ width: `${value ?? 0}%` }} />
                    </span>
                    <strong>{formatScore(value)}</strong>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div> : null}
    </section>
  );
}
