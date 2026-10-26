# 四商圈 20 個月正式資料集

本目錄將臺中市主要遊憩據點遊客行為資訊網的匿名網站端點轉換為可稽核、可重跑的離線研究快照。研究單位為「功能性商業活動區－月份」，不是經發局登錄商圈組織的法定邊界。

## 凍結範圍

- 草悟道（11）、一中（13）、逢甲（21）、公益路（8043）。
- 正式分析使用 2025-01 至 2026-08，共 20 個月；2026-09、2026-10 三項指標未齊，不納入指數。
- 每月人潮、平均停留時間、回訪率三項核心指標。
- 80 筆正式列、240 份指標原始 JSON。
- 快照日 2026-10-22；新版資料與 2026-10-08 舊快照及方法版本不可混用。

## 建立與驗證

```bash
TCDPI_SNAPSHOT_DATE=2026-10-22 TCDPI_STUDY_END=2026-08 node analysis/tourstats-formal-dataset/build-dataset.mjs
TCDPI_SNAPSHOT_DATE=2026-10-22 TCDPI_STUDY_END=2026-08 node analysis/tourstats-formal-dataset/build-dataset.mjs --verify-only
node --test analysis/tourstats-formal-dataset/tests/pipeline.test.mjs
```

首次執行會依序下載，採低併發及重試；已存在且可解析的原始 JSON 會被重用。`--verify-only` 不發出新的網路請求，只檢查本機原始檔、manifest、80 筆正式資料、WKT 雜湊與抽核值。舊快照須明確指定 `TCDPI_SNAPSHOT_DATE=2026-10-08 TCDPI_STUDY_END=2026-06`。

## 主要產物

- `raw/2026-10-22/`：完整官方原始 JSON 及官方頁面 HTML 快照；`availability/` 子目錄另存 9–10 月不完整月份查核回應。
- `metadata/2026-10-22/source-manifest.csv`／`.json`：來源網址、時間、回應 ID、HTTP 狀態及 SHA-256。
- `metadata/2026-10-22/data-dictionary.csv`：欄位定義、來源與驗證規則。
- `metadata/2026-10-22/method-version.json`：資料、邊界及 TCDPI 方法版本。
- `processed/tcdpi-core-2025-01_2026-08.csv`／`.json`：80 筆正式資料及指數結果。
- `processed/districts-2026-10-22.geojson`：四區 WKT、GeoJSON 與邊界雜湊。
- `processed/ranking-sensitivity-2025-01_2026-08.json`／`.csv`：等權、熵權、一致性與權重擾動結果。
- `processed/quality-report-2025-01_2026-08.json`／`.md`：完整性、有效性、抽核及限制。

## 研究限制

- API 是官方網站使用的匿名內部端點，並非有穩定性承諾的正式版本化 API。
- CRS `EPSG:4326` 來自網站前端實作觀察，仍待機關書面確認。
- 公益路異動歷程標示 2025-03-18 新增，但有效資料自 2025-01 開始，須確認邊界及資料生效日期。
- 電信資料為去識別化推估結果，不應解讀為人口普查值或營業額。
