import type { StudyDataset } from '../lib/types';

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
          {metadata ? `資料期間為 ${metadata.periodStart} 至 ${metadata.periodEnd}；` : ''}
          本指數用來描述人流熱度，不代表營收或整體經濟績效。
        </p>
      </div>
      <div className="methodology-grid">
        <article className="formula-card">
          <h3>指數公式</h3>
          <p className="formula">TCDPI = 0.40 × 吸引力 + 0.30 × 投入度 + 0.30 × 黏著度</p>
          <p>以月到訪人次、平均停留時間與重遊率計算，成長率只作趨勢參考。</p>
        </article>
        <article>
          <h3>資料來源</h3>
          <p>
            來源為
            <a href="https://tourstats.taichung.gov.tw/" rel="noreferrer">臺中市主要遊憩據點遊客行為資訊網</a>
            的電信推估資料，已去識別化。
          </p>
          <p>9–10 月官方三項指標尚未完整，故目前不列入計算；Google 評分與評論僅作參考，不納入指數。</p>
        </article>
        <article>
          <h3>使用限制</h3>
          <ul>
            <li>人流為推估值，不是精確人數，也不是消費或營收。</li>
            <li>商圈範圍依官方空間邊界，不一定等同商圈組織範圍。</li>
            <li>活動與季節都可能影響單月數字，請搭配趨勢閱讀。</li>
          </ul>
        </article>
      </div>
      <details className="methodology-details">
        <summary>計算方式細節</summary>
        <p>
          到訪人次先採 <span lang="en">log(1 + visitors)</span> 對數轉換，再對各項指標做
          1/99 百分位縮尾，降低極端值影響。
        </p>
        <p>以凍結的 min-max 基準期轉換為 0–100 分，後續月份沿用同一尺度，保留跨期可比性。</p>
        <p>另以等權重與熵權重重算排名，檢查結論是否受單一權重方案影響。</p>
        {metadata ? <p>方法版本：{metadata.methodVersion}｜資料快照：{metadata.sourceSnapshot}</p> : null}
      </details>
    </section>
  );
}
