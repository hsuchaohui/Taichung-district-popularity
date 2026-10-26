# 臺中市商圈熱門指數網站

本專案以臺中市四個商圈的政府人流開放資料，建立可追溯、可比較的商圈熱門指數，並以網站協助一般使用者了解商圈現況、月份變化與指數限制。研究範圍為 2025 年 1 月至 2026 年 8 月，共 20 個月、4 個商圈、80 筆商圈－月份資料。最新完整官方月份為 2026 年 8 月；9–10 月資料尚未同時具備三項指標，因此不列入正式指數。

## 指數與資料

TCDPI-core-v1.1.0 以月到訪人次、平均停留時間及重遊率形成三個構面，理論權重分別為 0.40、0.30、0.30。到訪人次先做 `log(1 + visitors)` 轉換，各項指標依固定基準期參數縮尾及轉換至 0–100，再計算指數。網站另呈現等權／熵權替代權重比較、排名敏感度、資料品質及方法限制。分數代表相對熱門程度，不代表營收、消費人數或商圈整體品質。

正式資料原始回應、WKT 邊界、資料字典、授權與方法版本、擷取清單及雜湊保存在 `analysis/tourstats-formal-dataset/`。處理後的資料、品質報告與排名敏感度輸出保存在其 `processed/` 目錄。原始官方快照採日期版本封存；9–10 月端點回應僅作可用性證據，不進入正式指數。

## 本機執行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

常用檢查：

```bash
npm test
npm run lint
npm run build
node --test analysis/tourstats-formal-dataset/tests/pipeline.test.mjs
TCDPI_SNAPSHOT_DATE=2026-10-22 TCDPI_STUDY_END=2026-08 node analysis/tourstats-formal-dataset/build-dataset.mjs --verify-only
```

資料管線程式與快照查核方式請見 `analysis/tourstats-formal-dataset/README.md`。正式資料版本期間如有更新，需建立新快照、更新版本與網站說明，不可把不完整月份補成 0。

## 研究問題

1. 如何整合具明確來源、空間邊界與定義的政府人流資料，建立可重複計算的商圈熱門指數？
2. 固定基準期標準化及替代權重會如何影響四商圈的指數分數與排名穩健性？
3. 網站如何以清楚的指數、趨勢、構面與資料限制資訊，協助使用者了解商圈狀況？

本研究不進行介面 A/B 或受試者測試；網站是研究成果的公開解釋與查詢介面。研究專題依序包含緒論、文獻探討、研究方法、研究結果，以及結論、討論及建議。

## 主要目錄

```text
app/                                      網站頁面與樣式
components/                               指數、排名、比較、地圖及方法說明
lib/study-data.ts                         正式研究資料載入與驗證
analysis/tourstats-formal-dataset/raw/    官方原始回應及證據封存
analysis/tourstats-formal-dataset/metadata/資料字典、授權、版本與擷取清單
analysis/tourstats-formal-dataset/processed/指數、品質與敏感度分析輸出
docs/research-project-decisions.md        研究範圍與方法決策紀錄
research/literature-2026-09-14/           文獻探討與研究定位
deliverables/                              五章專題研究報告
```

## 使用與解讀界線

網站供使用者比較四商圈的月份指數、構面及趨勢。人流指標是官方去識別化推估資料，不能解讀為精確人口普查或消費金額；WKT 功能區亦不必然等同商圈組織範圍。官方 API 尚非具版本契約的公開 API，座標系統及部分資料定義仍待主管機關書面確認。任何分析或轉載均應連同資料版本、方法、缺漏與限制一併說明。
