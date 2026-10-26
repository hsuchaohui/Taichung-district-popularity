# Validation Report

## Overall Assessment: Share with caveats

### Question and scope

本次驗證回答：商業多樣性、公共運輸可達性與商業韌性三項候選指標，是否具備以「臺中商圈」為粒度的第一版實作條件。資料截點為 2026-08-20；分析及時間解讀均採 Asia/Taipei。

### Methodology Review

候選資料依來源可取得性、分析粒度、空間可連結性與時間完整性四項門檻評估。原始下載檔與資料頁均保留 SHA-256；核心結論由已執行的 `candidate-indicator-data-quality.ipynb` 產生，沒有把相關關係寫成因果。

### Issues Found

1. **Critical — 公車完整介接尚未取得。** 官方站牌下載檔只有 26 列、1 個站點編號與 1 個站名；另有 300 路核定班表示例，但不是全市資料。班次可納入指標，完整來源取得前仍不得正式計分。
2. **Critical — 商業異動粒度不符。** 18 個可用月份的區域欄位都只有「臺中市」，且 2024-07 至 2026-06 期間缺 6 個月；不能推估商圈淨進入率或一年存續率。
3. **High — 商業登記只有現況快照。** 可支援現況多樣性與密度，但不能從仍存活店家回推歷史韌性，否則會產生存活者偏誤。
4. **High — 空間歸屬尚未執行。** 地址完整不等於座標或 WKT 歸屬正確；正式排名前須完成地址座標化、未匹配率與邊界尺度敏感度檢查。

### Calculation Spot-Checks

- 商業登記筆數：**Verified** — 64,961 筆，統一編號重複 0 筆。
- 商業地址與行業代碼完整率：**Verified** — 皆為 100%。
- 核准設立日期缺漏率：**Verified** — 1,025 / 64,961 = 1.58%。
- 公車路線列數：**Verified with parser caveat** — 寬鬆解析可得 392 列；嚴格解析在第 392 列遇到 EOF inside string。
- 公車站牌涵蓋：**Verified** — 26 列、1 個站點編號、1 個站名。
- 公車班表示例：**Verified** — 300 路單一路線、50 個站序、92 欄，其中 88 欄為核定班表時刻。
- 商業異動時間涵蓋：**Verified** — 18 個月份，內部缺月為 6 個，區域值只有臺中市。

### Visualization Review

技術報告使用由 0 起算的水平長條圖呈現欄位完整率，百分比單位與缺漏筆數保留於資料與工具提示。最終自包含 HTML 已通過桌面 1440px、窄版 390px、圖表、表格與來源對話框驗證。

### Suggested Improvements

1. 完成商業地址座標化，報告匹配率、地址品質分層與人工抽樣誤差。
2. 以商圈 WKT 及 300／500／800 公尺替代邊界重算多樣性，檢查排名穩健性。
3. 改用 TDX 或向臺中市交通局申請完整介接，把站點、路線、平／假日班次與平均班距分開定義。
4. 取得可識別店家事件且月份連續的設立／歇業資料後，再恢復商業韌性研究。

### Required Caveats for Stakeholders

- 「可實作」只適用於商業多樣性的現況橫斷面，不代表可做歷史趨勢。
- 交通阻斷只反映本次免申請公開下載內容；臺中市公車動態系統已於 2026-07-09 改用 `https://citybus.taichung.gov.tw/xmlbus4/`，正式 API 的涵蓋率須在取得端點規格／權限後重新驗證。
- 商業韌性的阻斷只反映目前官方公開下載內容，不代表其他授權來源必然不存在完整資料。
- 商業多樣性在正式排名前仍須通過地址定位、行業分類粒度與邊界尺度敏感度驗證。

### Reproducibility

- Notebook: `candidate-indicator-data-quality.ipynb`
- Detailed profile: `outputs/audit_profile.json`
- Readiness decision: `outputs/candidate_readiness.csv`
- Source hashes: `outputs/source_manifest.json`
- Portable report: `report/taichung-candidate-indicator-audit.html`
