import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <p className="eyebrow">LEGAL · PRIVACY</p>
      <h1>隱私權說明</h1>
      <p>
        使用 Google 互動地圖、Places 照片或代表店家評論功能時，網站會連線至 Google 服務，
        即時取得地圖、商家位置、商家資料、評論、照片與必要的來源標示；除 Place ID 外，
        本網站不會永久儲存這些 Google Maps／Places 內容。
      </p>
      <p>
        <a href="https://policies.google.com/privacy" rel="noreferrer">Google 隱私權政策</a>
      </p>
      <p>本頁不宣稱涵蓋所有法律要求，且須在公開發布前完成審閱。</p>
      <Link href="/">返回研究展示</Link>
    </main>
  );
}
