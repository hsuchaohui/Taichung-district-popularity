import type { StudyDataset } from '../lib/types';

const caveatTranslations = new Map([
  ['The anonymous endpoints are used by the official website but are not published as a versioned API contract.', '官方網站使用的匿名資料端點並未發布為有版本保證的公開 API 契約。'],
  ['EPSG:4326 is observed from the website implementation and remains pending written agency confirmation.', '座標系統依網站實作判讀為 EPSG:4326，仍待主管機關書面確認。'],
  ['The public change log says Gongyi Road was added on 2025-03-18 while valid observations begin in 2025-01; the effective boundary/data date requires agency confirmation.', '官方異動紀錄顯示公益路於 2025-03-18 納入，但有效觀測自 2025-01 開始，邊界與資料生效日期仍待確認。'],
  ['Telecom-derived measures are de-identified estimates and must not be interpreted as exact census counts or revenue.', '電信推估資料為去識別化估計值，不是精確人口普查或營收數據。'],
]);

export function Methodology({ studyData }: { studyData?: StudyDataset }) {
  const metadata = studyData?.core.metadata;
  return (
    <section id="methodology" className="methodology-section" aria-labelledby="methodology-title">
      <div className="section-intro">
        <div>
          <p className="eyebrow">METHODOLOGY</p>
          <h2 id="methodology-title">研究方法與資料界線</h2>
        </div>
        <p>
          {metadata ? `正式資料期間為 ${metadata.periodStart} 至 ${metadata.periodEnd}；` : ''}
          本指數用來描述人流熱度，不代表營收或整體經濟績效。
        </p>
      </div>
      <div className="methodology-grid">
        <article className="formula-card">
          <h3>指數公式</h3>
          <p className="formula">TCDPI = 0.40 × 吸引力 + 0.30 × 投入度 + 0.30 × 黏著度</p>
          <p>成長率只作趨勢解讀，不納入綜合分數，避免短期波動扭曲商圈的結構性表現。</p>
        </article>
        <article>
          <h3>轉換與標準化</h3>
          <p>
            到訪人次先採 <span lang="en">log(1 + visitors)</span> 對數轉換，再對各項指標做
            1/99 百分位縮尾（winsorization），降低極端值影響。
          </p>
          <p>以凍結的 min-max 基準期轉換為 0–100 分，後續月份沿用同一尺度，保留跨期可比性。</p>
        </article>
        <article>
          <h3>穩健性檢驗</h3>
          <p>主規格採預先設定權重，另以等權重與熵權重重算排名，檢查結論是否受單一權重方案支配。</p>
        </article>
        <article>
          <h3>資料版本與來源限制</h3>
          {metadata ? <p>方法版本：{metadata.methodVersion}｜資料快照：{metadata.sourceSnapshot}</p> : null}
          <ul>
            {studyData?.caveats.map((caveat) => <li key={caveat}>{caveatTranslations.get(caveat) ?? caveat}</li>)}
          </ul>
          <p>官方來源：<a href="https://tourstats.taichung.gov.tw/" rel="noreferrer">臺中市主要遊憩據點遊客行為資訊網</a>。原始資料、授權條款、指標定義及空間邊界依來源快照留存。</p>
        </article>
        <article>
          <h3>研究限制</h3>
          <p>
            月人流為電信推估值，商圈範圍依官方景點空間邊界對照；不同營業型態、活動與季節都可能影響指數。
          </p>
          <p>9–10 月官方三項指標尚未完整，故目前不列入計算；Google 評分與評論不納入 TCDPI。</p>
        </article>
      </div>
    </section>
  );
}
