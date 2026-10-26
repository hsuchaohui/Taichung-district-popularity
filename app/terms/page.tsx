import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="legal-page">
      <p className="eyebrow">LEGAL · TERMS</p>
      <h1>使用條款</h1>
      <p>
        本網站為研究展示雛形，不構成正式研究結論或法律建議。Google Maps／Places
        內容另受 Google Maps／Google Earth 附加服務條款約束。
      </p>
      <p>
        <a href="https://maps.google.com/help/terms_maps/" rel="noreferrer">
          Google Maps／Google Earth 附加服務條款
        </a>
      </p>
      <p>本頁與 Google Places 的呈現方式仍須在公開發布前由適任人員完成審閱。</p>
      <Link href="/">返回研究展示</Link>
    </main>
  );
}
