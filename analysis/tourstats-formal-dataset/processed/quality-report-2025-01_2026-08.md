# 四商圈 20 個月正式資料集品質報告

狀態：**Share with caveats**  
資料粒度：功能性商業活動區－月份  
期間：2025-01 至 2026-08

## 驗收結果

| 檢查 | 結果 |
|---|---:|
| row_count | 80 |
| expected_row_count | 80 |
| unique_key_count | 80 |
| metric_raw_response_count | 240 |
| expected_metric_raw_response_count | 240 |
| spot_count | 4 |
| month_count | 20 |
| date_scope_min | 2020-01-01T00:00:00 |
| date_scope_max | 2026-08-01T00:00:00 |
| boundary_hashes_match_baseline | true |
| june_2026_anchor_values_match | true |
| all_scores_bounded | true |

## 錯誤

- 無

## 警告

- 1 temporal anomalies were flagged and retained.

## 時序異常標記

- 21 2025-04 visitors: 66.03%

## 重要限制

- The anonymous endpoints are used by the official website but are not published as a versioned API contract.
- EPSG:4326 is observed from the website implementation and remains pending written agency confirmation.
- The public change log says Gongyi Road was added on 2025-03-18 while valid observations begin in 2025-01; the effective boundary/data date requires agency confirmation.
- Telecom-derived measures are de-identified estimates and must not be interpreted as exact census counts or revenue.
