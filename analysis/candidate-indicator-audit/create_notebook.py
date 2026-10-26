from pathlib import Path

import nbformat as nbf


ROOT = Path(__file__).resolve().parent
NOTEBOOK = ROOT / "candidate-indicator-data-quality.ipynb"

nb = nbf.v4.new_notebook()
nb["metadata"] = {
    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
    "language_info": {"name": "python", "version": "3"},
}

cells = []

cells.append(
    nbf.v4.new_markdown_cell(
        """# 臺中商圈候選指標資料品質稽核

## tl;dr

下方摘要由本次保存的官方資料快照直接計算。判定對象是三項第一優先候選指標：商業多樣性、公共運輸可達性與商業韌性。"""
    )
)

cells.append(
    nbf.v4.new_code_cell(
        """from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from datetime import datetime, timezone
import csv
import hashlib
import io
import json
import math
import re

import pandas as pd
from IPython.display import display, Markdown

AUDIT_DATE = "2026-08-20"
BASE_DIR = Path.cwd()
RAW_DIR = BASE_DIR / "raw" / AUDIT_DATE
OUTPUT_DIR = BASE_DIR / "outputs"
RAW_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SOURCES = {
    "business_snapshot": {
        "dataset_page": "https://data.gov.tw/dataset/52935",
        "download_url": "https://data.gcis.nat.gov.tw/od/file?oid=C0DC4B38-796A-4405-B72F-62EADAB1082A",
        "filename": "taichung-business-f.csv",
        "license": "政府資料開放授權條款第1版",
    },
    "bus_routes": {
        "dataset_page": "https://data.gov.tw/dataset/83748",
        "download_url": "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=20c2e4cc-49bf-45d5-a880-714c7c66eed6",
        "filename": "taichung-bus-routes.csv",
        "license": "政府資料開放授權條款第1版",
    },
    "bus_stops": {
        "dataset_page": "https://data.gov.tw/dataset/81555",
        "download_url": "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=d905afab-f80d-4044-a2f4-5e0753a1c60e",
        "filename": "taichung-bus-stops.csv",
        "license": "政府資料開放授權條款第1版",
    },
    "bus_schedule_sample": {
        "dataset_page": "https://data.gov.tw/dataset/83747",
        "download_url": "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=ae0debce-1444-4d21-b5ea-958dcc9ef2be",
        "filename": "taichung-bus-route-300-schedule-sample.csv",
        "license": "政府資料開放授權條款第1版",
    },
    "business_changes_page": {
        "dataset_page": "https://data.gov.tw/dataset/127264",
        "filename": "business-changes-page.html",
        "license": "政府資料開放授權條款第1版",
    },
    "business_stock_changes_page": {
        "dataset_page": "https://data.gov.tw/dataset/114027",
        "filename": "business-stock-changes-page.html",
        "license": "政府資料開放授權條款第1版",
    },
}

def fetch_bytes(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 candidate-indicator-audit/1.0"})
    with urlopen(request, timeout=90) as response:
        return response.read()

def save_snapshot(url: str, path: Path) -> bytes:
    if path.exists():
        return path.read_bytes()
    payload = fetch_bytes(url)
    path.write_bytes(payload)
    return payload

def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()

download_manifest = []
for source_id in ("business_snapshot", "bus_routes", "bus_stops", "bus_schedule_sample"):
    source = SOURCES[source_id]
    path = RAW_DIR / source["filename"]
    payload = save_snapshot(source["download_url"], path)
    download_manifest.append({
        "source_id": source_id,
        "dataset_page": source["dataset_page"],
        "download_url": source["download_url"],
        "local_file": str(path.relative_to(BASE_DIR)),
        "bytes": len(payload),
        "sha256": sha256(payload),
        "license": source["license"],
    })

for source_id in ("business_changes_page", "business_stock_changes_page"):
    source = SOURCES[source_id]
    path = RAW_DIR / source["filename"]
    payload = save_snapshot(source["dataset_page"], path)
    download_manifest.append({
        "source_id": source_id,
        "dataset_page": source["dataset_page"],
        "download_url": source["dataset_page"],
        "local_file": str(path.relative_to(BASE_DIR)),
        "bytes": len(payload),
        "sha256": sha256(payload),
        "license": source["license"],
    })

print(f"已保存 {len(download_manifest)} 個主要來源快照。")"""
    )
)

cells.append(
    nbf.v4.new_markdown_cell(
        """## Context & Methods

### Key Assumptions

- 預定正式分析粒度為「商圈－月份」。只具臺中市總體值的資料不能直接計算商圈指標。
- 商圈歸屬需要可重現的商圈 WKT 與地址座標。只有文字地址時，先判為可做城市層資料品質檢查，但尚未具備空間 join 能力。
- 此稽核不將即時或現況快照回推成歷史序列，也不把缺少的月份補成零。
- 下載檔以 SHA-256、來源頁、實體下載網址及稽核日期封存。"""
    )
)

cells.append(
    nbf.v4.new_markdown_cell("## Data\n\n### 1. 商業登記現況快照")
)

cells.append(
    nbf.v4.new_code_cell(
        """business_path = RAW_DIR / SOURCES["business_snapshot"]["filename"]
business = pd.read_csv(business_path, dtype=str, encoding="utf-8-sig", keep_default_na=False)
business.columns = [column.lstrip("\\ufeff") for column in business.columns]

required_business_columns = [
    "統一編號", "商業名稱", "商業地址", "實收資本額", "核准設立日期",
    "營業地址（財政資訊中心匯入）", "行業代號（財政資訊中心匯入）", "財政資訊中心匯入日期",
]
assert list(business.columns) == required_business_columns

business_profile = {
    "rows": int(len(business)),
    "columns": int(len(business.columns)),
    "exact_duplicate_rows": int(business.duplicated().sum()),
    "duplicate_unified_numbers": int(business["統一編號"].duplicated().sum()),
    "distinct_industry_codes": int(business["行業代號（財政資訊中心匯入）"].replace("", pd.NA).nunique()),
    "taichung_business_address_rate": float(business["商業地址"].str.startswith(("臺中市", "台中市")).mean()),
    "taichung_tax_address_rate": float(business["營業地址（財政資訊中心匯入）"].str.startswith(("臺中市", "台中市")).mean()),
}

business_completeness = pd.DataFrame({
    "field": business.columns,
    "non_empty_rows": [(business[column].str.strip() != "").sum() for column in business.columns],
})
business_completeness["total_rows"] = len(business)
business_completeness["complete_rate"] = business_completeness["non_empty_rows"] / len(business)
business_completeness["missing_rows"] = len(business) - business_completeness["non_empty_rows"]
business_completeness = business_completeness.sort_values("complete_rate", ascending=True).reset_index(drop=True)

capital_numeric = pd.to_numeric(business["實收資本額"].str.replace(",", "", regex=False), errors="coerce")
business_profile["invalid_nonempty_capital"] = int(((business["實收資本額"].str.strip() != "") & capital_numeric.isna()).sum())
business_profile["negative_capital"] = int((capital_numeric < 0).sum())

display(pd.DataFrame([business_profile]))
display(business_completeness[["field", "non_empty_rows", "missing_rows", "complete_rate"]])"""
    )
)

cells.append(nbf.v4.new_markdown_cell("### 2. 公車路線與站牌座標"))

cells.append(
    nbf.v4.new_code_cell(
        """def read_utf8_csv(path: Path):
    strict_error = None
    try:
        frame = pd.read_csv(path, dtype=str, encoding="utf-8-sig", keep_default_na=False)
    except pd.errors.ParserError as error:
        strict_error = str(error)
        text = path.read_text(encoding="utf-8-sig")
        parsed_rows = list(csv.reader(io.StringIO(text), strict=False))
        header, data_rows = parsed_rows[0], parsed_rows[1:]
        malformed_widths = [len(row) for row in data_rows if len(row) != len(header)]
        if malformed_widths:
            raise ValueError(f"容錯解析後仍有欄數異常：{malformed_widths[:5]}") from error
        frame = pd.DataFrame(data_rows, columns=header, dtype=str)
    frame.columns = [column.lstrip("\\ufeff") for column in frame.columns]
    return frame, strict_error

bus_routes, bus_routes_strict_error = read_utf8_csv(RAW_DIR / SOURCES["bus_routes"]["filename"])
bus_stops, bus_stops_strict_error = read_utf8_csv(RAW_DIR / SOURCES["bus_stops"]["filename"])
bus_schedule, bus_schedule_strict_error = read_utf8_csv(RAW_DIR / SOURCES["bus_schedule_sample"]["filename"])

for coordinate in ("緯度", "經度"):
    bus_stops[coordinate + "_numeric"] = pd.to_numeric(bus_stops[coordinate], errors="coerce")

bus_profile = {
    "route_rows": int(len(bus_routes)),
    "route_csv_strict_parse_passed": bus_routes_strict_error is None,
    "route_csv_strict_parse_error": bus_routes_strict_error,
    "distinct_route_labels": int(bus_routes["路線"].nunique()),
    "route_rows_with_outbound_text": int((bus_routes["去程"].str.strip() != "").sum()),
    "route_rows_with_return_text": int((bus_routes["回程"].str.strip() != "").sum()),
    "stop_route_rows": int(len(bus_stops)),
    "distinct_stop_ids": int(bus_stops["站點編號"].nunique()),
    "distinct_stop_names": int(bus_stops["站點名稱"].nunique()),
    "distinct_stop_routes": int(bus_stops["路線名稱"].nunique()),
    "valid_coordinate_rows": int((bus_stops["緯度_numeric"].between(23.5, 25.0) & bus_stops["經度_numeric"].between(119.5, 121.5)).sum()),
    "exact_duplicate_stop_rows": int(bus_stops.duplicated(subset=["路線名稱", "去返程", "站序", "站點編號", "緯度", "經度"]).sum()),
    "schedule_sample_route_labels": sorted(bus_schedule["路線"].unique().tolist()),
    "schedule_sample_stop_rows": int(len(bus_schedule)),
    "schedule_sample_columns": int(len(bus_schedule.columns)),
    "schedule_sample_timetable_columns": int(sum(column.startswith("核定班表") for column in bus_schedule.columns)),
    "schedule_sample_is_citywide": bool(bus_schedule["路線"].nunique() > 1),
}

display(pd.DataFrame([bus_profile]))
display(bus_stops[["路線名稱", "去返程", "站點編號", "站點名稱", "緯度", "經度"]].head(10))"""
    )
)

cells.append(nbf.v4.new_markdown_cell("### 3. 商業異動月資料的時間與粒度"))

cells.append(
    nbf.v4.new_code_cell(
        """def extract_distribution_urls(page_bytes: bytes) -> list[str]:
    text = page_bytes.decode("utf-8", errors="replace")
    candidates = re.findall(r'"contentUrl":"(https://newdatacenter\\.taichung\\.gov\\.tw/api/v1/no-auth/resource\\.download\\?rid=[^"]+)"', text)
    return list(dict.fromkeys(candidates))

def download_json_distributions(source_id: str, prefix: str) -> tuple[list[dict], list[dict]]:
    page_path = RAW_DIR / SOURCES[source_id]["filename"]
    urls = extract_distribution_urls(page_path.read_bytes())
    resources = []
    combined_rows = []
    for index, url in enumerate(urls, start=1):
        payload = fetch_bytes(url)
        rows = json.loads(payload.decode("utf-8-sig"))
        observed_dates = sorted({row.get("資料時間日期", "")[:10] for row in rows if row.get("資料時間日期")})
        date_label = observed_dates[0] if len(observed_dates) == 1 else f"resource-{index:02d}"
        filename = f"{prefix}-{date_label}.json"
        path = RAW_DIR / filename
        if not path.exists():
            path.write_bytes(payload)
        resources.append({
            "source_id": source_id,
            "download_url": url,
            "local_file": str(path.relative_to(BASE_DIR)),
            "bytes": len(payload),
            "sha256": sha256(payload),
            "observed_dates": observed_dates,
            "rows": len(rows),
        })
        combined_rows.extend(rows)
    return resources, combined_rows

change_resources, change_rows = download_json_distributions("business_changes_page", "business-changes")
stock_resources, stock_rows = download_json_distributions("business_stock_changes_page", "business-stock-changes")
download_manifest.extend(change_resources)
download_manifest.extend(stock_resources)

changes = pd.DataFrame(change_rows)
stock_changes = pd.DataFrame(stock_rows)

def temporal_profile(frame: pd.DataFrame) -> dict:
    dates = pd.to_datetime(frame["資料時間日期"], errors="coerce")
    months = sorted(dates.dropna().dt.to_period("M").astype(str).unique())
    full_range = pd.period_range(months[0], months[-1], freq="M").astype(str).tolist() if months else []
    return {
        "rows": int(len(frame)),
        "distinct_months": len(months),
        "first_month": months[0] if months else None,
        "last_month": months[-1] if months else None,
        "missing_months_inside_range": sorted(set(full_range) - set(months)),
        "distinct_areas": sorted(frame["地區"].dropna().unique().tolist()),
        "district_granularity_available": bool(frame["地區"].nunique() > 1),
        "distinct_field_names": int(frame["欄位名稱"].nunique()),
        "duplicate_metric_month_rows": int(frame.duplicated(subset=["資料時間日期", "項目", "欄位名稱"]).sum()),
    }

change_profile = temporal_profile(changes)
stock_profile = temporal_profile(stock_changes)
display(pd.DataFrame([{"dataset": "商業登記異動", **change_profile}, {"dataset": "商業登記家數及資本額異動", **stock_profile}]))
display(changes[["地區", "項目", "欄位名稱", "數值", "資料時間日期"]].head(12))"""
    )
)

cells.append(nbf.v4.new_markdown_cell("## Results\n\n### 4. 候選指標是否達到商圈－月份需求"))

cells.append(
    nbf.v4.new_code_cell(
        '''readiness = pd.DataFrame([
    {
        "candidate": "商業多樣性",
        "raw_data_status": "可下載",
        "grain_match": "部分",
        "spatial_readiness": "需地址座標化與WKT",
        "temporal_readiness": "僅現況快照",
        "decision": "可先做橫斷面，不納入月度TCDPI",
        "severity": "High",
    },
    {
        "candidate": "公共運輸可達性",
        "raw_data_status": "路線可下載；另有300路核定班表示例；站牌檔疑似不完整",
        "grain_match": "未達標",
        "spatial_readiness": f"站牌檔僅{bus_profile['stop_route_rows']}列/{bus_profile['distinct_stop_ids']}個站點編號",
        "temporal_readiness": "無固定月快照",
        "decision": "以TDX或申請介接取得全市站點與完整班表",
        "severity": "Critical",
    },
    {
        "candidate": "商業韌性",
        "raw_data_status": "月統計可下載",
        "grain_match": "未達標",
        "spatial_readiness": "只有臺中市總體",
        "temporal_readiness": f"{change_profile['first_month']}至{change_profile['last_month']}且月份不連續",
        "decision": "只能作城市背景，不可計商圈韌性",
        "severity": "Critical",
    },
])

display(readiness)

summary_text = f"""
**結論：三項候選目前都不能直接加入正式月度總分。**

- 商業登記快照有 **{business_profile['rows']:,}** 筆，統編重複 **{business_profile['duplicate_unified_numbers']}** 筆，具備橫斷面的商業多樣性基礎；但沒有座標與完整歷史歇業資料。
- 公車路線表有 **{bus_profile['route_rows']:,}** 列；另有 **300 路**核定班表示例（**{bus_profile['schedule_sample_stop_rows']}** 個站序、**{bus_profile['schedule_sample_timetable_columns']}** 個班表欄位），但官方站牌座標資源只有 **{bus_profile['stop_route_rows']}** 列、**{bus_profile['distinct_stop_ids']}** 個站點編號。班次資料確實存在，現行免申請下載內容仍不足以代表臺中市全體服務。
- 商業異動資源只有 **{', '.join(change_profile['distinct_areas'])}** 總體粒度，且 {change_profile['first_month']} 至 {change_profile['last_month']} 之間缺少 **{len(change_profile['missing_months_inside_range'])}** 個月份，不能計算商圈存續或淨進入率。
"""
display(Markdown(summary_text))'''
    )
)

cells.append(nbf.v4.new_markdown_cell("### 5. 可自動化的品質門檻"))

cells.append(
    nbf.v4.new_code_cell(
        """automated_checks = pd.DataFrame([
    {"dataset": "商業登記", "test": "統一編號唯一且非空", "threshold": "100%", "current": f"重複 {business_profile['duplicate_unified_numbers']} 筆"},
    {"dataset": "商業登記", "test": "商業地址可辨識為臺中市", "threshold": ">=99%", "current": f"{business_profile['taichung_business_address_rate']:.2%}"},
    {"dataset": "商業登記", "test": "行業代碼非空", "threshold": ">=95%", "current": f"{(business['行業代號（財政資訊中心匯入）'].str.strip() != '').mean():.2%}"},
    {"dataset": "公車站牌", "test": "合理全市站點涵蓋", "threshold": ">1,000 unique stop IDs（暫定，待官方基準）", "current": str(bus_profile['distinct_stop_ids'])},
    {"dataset": "商業異動", "test": "共同研究期間月份連續", "threshold": "缺月=0", "current": f"缺 {len(change_profile['missing_months_inside_range'])} 月"},
    {"dataset": "商業異動", "test": "可識別商圈或店家事件", "threshold": "可空間join", "current": "只有臺中市總體"},
])
display(automated_checks)"""
    )
)

cells.append(nbf.v4.new_markdown_cell("## Takeaways"))

cells.append(
    nbf.v4.new_markdown_cell(
        """1. **商業多樣性可以先做橫斷面試算。** 下一個必要步驟是取得四商圈 WKT、將文字地址座標化，並比較兩種行業分類層級的 Shannon entropy。
2. **公車班次應納入可達性，但完整資料須換介接方式。** 政府平臺提供 300 路核定班表示例，證明可定義平日／假日班次數與平均班距；然而完整服務須以具憑證的 TDX StopOfRoute／Schedule API，或向臺中市交通局申請公車動態資料庫介接。
3. **商業韌性暫時不能形成商圈指標。** 現有月統計只有臺中市總體，且發布月份不連續；須取得店家層的新設／歇業事件，或從現在開始固定封存每月營業快照。
4. **TCDPI 第 1 版不變。** 在上述資料缺口補齊前，三項候選只作研究設計與資料取得工作，不進入目前 0.40／0.30／0.30 總分。"""
    )
)

cells.append(
    nbf.v4.new_code_cell(
        """profile = {
    "audit_date": AUDIT_DATE,
    "business_profile": business_profile,
    "bus_profile": bus_profile,
    "business_changes_profile": change_profile,
    "business_stock_changes_profile": stock_profile,
    "readiness": readiness.to_dict(orient="records"),
    "download_manifest": download_manifest,
}

(OUTPUT_DIR / "audit_profile.json").write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
business_completeness.to_csv(OUTPUT_DIR / "business_completeness.csv", index=False, encoding="utf-8-sig")
readiness.to_csv(OUTPUT_DIR / "candidate_readiness.csv", index=False, encoding="utf-8-sig")
automated_checks.to_csv(OUTPUT_DIR / "automated_quality_checks.csv", index=False, encoding="utf-8-sig")
(OUTPUT_DIR / "source_manifest.json").write_text(json.dumps(download_manifest, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")

print("輸出：", sorted(path.name for path in OUTPUT_DIR.iterdir()))"""
    )
)

nb["cells"] = cells
nbf.write(nb, NOTEBOOK)
print(NOTEBOOK)
