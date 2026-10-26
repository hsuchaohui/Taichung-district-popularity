"""Build an auditable research snapshot from observed Google Maps UI evidence."""
import csv
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.parse import quote
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
raw = json.loads((ROOT / 'google-audit-raw.json').read_text())
shortlist = json.loads((ROOT / 'shortlist.json').read_text())['stores']
address_notes = {
    1: '初選逢甲路20號；Google列22號，門牌差異待店家或現場確認。',
    4: '初選文華路99-2號；Google列文華路81號對面，攤位位置差異待現場確認。',
    8: '初選福星路461巷2-2號；Google列2號，門牌差異待店家或現場確認。',
    13: '初選育才南街31號；Google列33號，店名為盧の堡半月燒餡餅一中直營店，門牌差異待確認。',
    14: '初選太平路65-1號；Google列65號，門牌差異待店家或現場確認。',
    37: '初選民生北路107號；Google列模範街1巷1號，兩來源位置不同，需確認現址後再做商圈邊界比對。',
}
extra_notes = {
    5: '採文華路29號的創始店路邊攤，排除慶和街101號店面分店。',
    12: '採一中街96號1F-04愛廣場店，排除尊賢街及益民分店。',
    19: 'Google店名為誠品生活中友店，地址列C棟10F；初選來源列10、11樓。',
    25: 'Google標示永久歇業；現存評分及評論數為歷史資料，建議從現役候選中停用。',
    30: '採公益路68號3樓的誠品生活園道店（書店），排除勤美誠品綠園道整棟商場及誠品文具。',
    32: 'Google標示永久歇業；現存評分及評論數為歷史資料，建議從現役候選中停用。',
}

def local_time(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(ZoneInfo('Asia/Taipei')).isoformat(timespec='seconds')

def first(pattern, text):
    match = re.search(pattern, text)
    assert match, pattern
    return match[1]

def focused_evidence(text):
    # Keep only business identity and aggregate statistics, not account or reviewer data.
    return '\n'.join(line for line in text.splitlines() if re.search(
        r'heading .*\[level=1\]|img "[0-9.,]+ (?:顆星"|則評論")|button "地址:|'
        r'button "(?:營業時間 .+|營業中 .+|通知 永久歇業 .+)"|'
        r'img "[1-5] 星級、|generic: 永久歇業', line
    ) and '贊助商' not in line)

rows, evidence = [], []
for r in sorted(raw, key=lambda item: item['index']):
    idx = r['index']
    source = shortlist[idx]
    text = r['snapshot']
    name = next(name for name in re.findall(r'heading "([^\n]+)" \[level=1\]', text)
                if name != '結果' and not name.startswith('贊助商'))
    address = first(r'button "地址: ([^"\n]+)"', text)
    rating = float(first(r'img "([0-9.]+) 顆星"', text))
    count = int(first(r'img "([0-9,]+) 則評論"', text).replace(',', ''))
    stars = {star: int(n.replace(',', '')) for star, n in re.findall(r'img "([1-5]) 星級、([0-9,]+) 則評論"', text)}
    assert len(stars) == 5 and sum(stars.values()) == count, name
    closed = 'generic: 永久歇業' in text
    hours = [value for value in re.findall(r'button "([^"\n]+)"', text)
             if (value.startswith('營業時間 ') and '顯示本週營業時間' in value)
             or (value.startswith('營業中 ') and '營業時間' in value)]
    assert closed or hours, name
    hours_text = '永久歇業' if closed else hours[0]
    finder = r.get('finder_snapshot') or ''
    validation = r.get('place_id_validation')
    pid = r.get('place_id') or first(r'- text: (ChI\S+)', finder)
    if validation:
        assert validation['match'] and validation['name_match'] and validation['address_match']
        id_method = '由已核對商家網址的識別資料轉換候選ID，再以Google Maps query_place_id連結回查；店名與地址相符'
        id_source = validation['request_url']
        id_checked_at = local_time(validation['checked_at'])
    elif r.get('place_id_source_url'):
        assert pid in r['place_id_source_url']
        id_method = 'Google Maps可見搜尋結果商家連結中的Place ID；與詳細頁店名、地址及網址識別資料比對'
        id_source = r['place_id_source_url']
        id_checked_at = local_time(r['checked_at'])
    else:
        assert f'- text: {name}' in finder and pid in finder, name
        id_method = 'Google官方Place ID Finder；以顯示的店名、地址及商家網址識別資料比對'
        id_source = 'https://geo-devrel-javascript-samples.web.app/samples/places-placeid-finder/app/dist/'
        id_checked_at = None  # Finder was checked later in the same session; no invented exact timestamp.
    row = {
        'district': source['district'], 'display_order': source['display_order'],
        'original_name': source['name'], 'google_display_name': name,
        'category': source['category'], 'original_address': source['address'],
        'google_address': address, 'place_id': pid,
        'place_id_verified': True, 'place_id_verification_method': id_method,
        'place_id_checked_on': '2026-09-03', 'place_id_checked_at': id_checked_at,
        'business_status_observed': '永久歇業' if closed else '商家頁列有營業時間',
        'operating_candidate': not closed,
        'hours_status_observed': hours_text,
        'google_rating': rating, 'google_user_rating_count': count,
        **{f'google_star_{n}_count': stars[str(n)] for n in range(5, 0, -1)},
        'rating_distribution_sum_matches': True,
        'review_data_scope': '評分、評論總數、1至5星評論數；未收錄逐則評論全文或最新評論日期',
        'google_checked_at': local_time(r['checked_at']),
        'google_maps_url': f'https://www.google.com/maps/search/?api=1&query={quote(name)}&query_place_id={pid}',
        'google_observed_url': r['maps_url'], 'place_id_source_url': id_source,
        'address_discrepancy': idx in address_notes,
        'identity_match_note': 'Google商家已識別；與初選門牌的差異待確認' if idx in address_notes else '店名與地址對應初選分店',
        'notes': ' '.join(filter(None, [address_notes.get(idx), extra_notes.get(idx)])),
        'boundary_status': source['boundary_status'],
        'original_source_url': source['source_url'],
    }
    rows.append(row)
    evidence.append({'district': row['district'], 'original_name': row['original_name'],
                     'place_id': pid, 'google_checked_at': row['google_checked_at'],
                     'google_observed_url': r['maps_url'], 'business_evidence': focused_evidence(text),
                     'finder_evidence': finder.split('- iframe')[0] if 'Place ID:' in finder else None,
                     'place_id_source_url': id_source,
                     'place_id_validation': {key: value for key, value in (validation or {}).items() if key != 'snapshot'},
                     'place_id_validation_evidence': focused_evidence(validation['snapshot']) if validation else None})

assert len(rows) == 40 and len({r['place_id'] for r in rows}) == 40
assert set(Counter(r['district'] for r in rows).values()) == {10}
assert sum(not r['operating_candidate'] for r in rows) == 2
summary = {'checked_on': '2026-09-03', 'timezone': 'Asia/Taipei', 'total': 40,
           'place_ids_verified': 40, 'listed_with_hours': 38, 'permanently_closed': 2,
           'address_discrepancies': 6, 'rating_distribution_checks_passed': 40}
metadata = {
    'summary': summary,
    'method': '逐家讀取Google Maps商家詳細頁；Place ID由官方Finder、可見Maps連結或候選ID回查確認。回查使用query=0,0，避免ID無法解析時以店名搜尋造成假陽性。',
    'limitations': ['本次為Google公開頁面快照，未使用Places API businessStatus欄位；列有營業時間是頁面觀察，不等於查詢當刻正在營業或實地確認。',
                    'Google評論數與評分可能持續變動；本次評論資料不包含逐則全文、完整歷史或最新評論日期。',
                    '6家初選門牌與Google資料有差異；地址差異不等於已證實搬遷。',
                    '商圈WKT邊界尚待空間比對；不得將38家都視為已通過研究邊界審查。',
                    'Google評論僅作店家補充資訊，不納入TCDPI核心指數。'],
    'stores': rows,
}
(ROOT / 'google-verification.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n')
(ROOT / 'google-verification-evidence.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2)+'\n')
with (ROOT / 'google-verification.csv').open('w', encoding='utf-8-sig', newline='') as file:
    writer = csv.DictWriter(file, fieldnames=list(rows[0]))
    writer.writeheader(); writer.writerows(rows)

lines = ['# 四商圈代表性店家 Google 核對結果', '',
         '查核日期：2026-09-03（Asia/Taipei）。40家完成Google商家識別、評分、評論總數及星等分布核對；38家列有營業時間，2家標示永久歇業。', '',
         '資料檔：[CSV](google-verification.csv)｜[JSON](google-verification.json)｜[核對證據](google-verification-evidence.json)。原始初選名單保留於 [shortlist.md](shortlist.md)。', '',
         '## 需要處理的店家', '',
         '| 店家 | Google狀態 | 評分 | 評論數 | 處理建議 |', '|---|---|---:|---:|---|']
for row in rows:
    if not row['operating_candidate']:
        lines.append(f"| [{row['original_name']}]({row['google_maps_url']}) | 永久歇業 | {row['google_rating']:.1f} | {row['google_user_rating_count']:,} | 停用現役候選；保留歷史紀錄 |")
lines += ['', '因此現役候選暫為逢甲10家、一中10家、公益路9家、草悟道9家。尚未自動替換兩家停業店家。', '',
          '## 地址差異', '', '| 店家 | 初選地址 | Google地址 |', '|---|---|---|']
for row in rows:
    if row['address_discrepancy']:
        lines.append(f"| [{row['original_name']}]({row['google_maps_url']}) | {row['original_address']} | {row['google_address']} |")
lines += ['', '以上是兩個來源的差異，尚不能直接斷定已搬遷。Google商家編號已確認，但初選門牌與現址的關係仍需店家或現場確認。', '', '## 完整40家核對表', '',
          '「列有營業時間」表示Google商家頁仍提供營業排程；當刻可能正在營業、午休或尚未開店。查詢當刻的完整文字與時間保存在CSV、JSON。點店名可開啟對應Place ID的Google Maps頁面。']
for district in dict.fromkeys(row['district'] for row in rows):
    lines += ['', f'### {district}', '', '| 店家（Google名稱） | 評分 | 評論數 | 狀態 | Place ID |', '|---|---:|---:|---|---|']
    for row in rows:
        if row['district'] == district:
            flag = ' †' if row['address_discrepancy'] else ''
            lines.append(f"| [{row['google_display_name']}]({row['google_maps_url']}){flag} | {row['google_rating']:.1f} | {row['google_user_rating_count']:,} | {row['business_status_observed']} | `{row['place_id']}` |")
lines += ['', '† 表示與初選地址有差異，詳見上表。', '', '## 核對方法與資料範圍', '',
          '- 先以店名及地址找到商家詳細頁；同品牌不同分店、書店與整棟商場分開比對。',
          '- 16家Place ID來自Google官方Finder或Google Maps可見商家連結；其餘24家從已核對商家網址取得候選識別碼後，再以Place ID連結逐家回查店名與地址。每筆方法與來源均存入JSON。',
          '- 回查使用`query=0,0`而非店名作備援搜尋，因此不能靠同名搜尋掩蓋無效ID。這是Google Maps連結驗證，並非Places API欄位測試。[Google Maps URL官方說明](https://developers.google.com/maps/documentation/urls/get-started#search)',
          '- 評論資料包含平均星等、評論總數，以及五星至一星各自的評論數。40家星等分布加總全部與詳細頁評論總數一致。',
          '- 未收錄逐則評論全文、最新一則評論日期或完整歷史評論。本次數據是查核時快照，不應當成網站永久不變的資料。',
          '- 六家地址差異、兩家永久歇業及商圈WKT邊界比對，均需在正式現役名單定案時處理。',
          '- Google評論資料維持作店家補充資訊，不納入TCDPI核心指數。', '']
(ROOT / 'google-verification.md').write_text('\n'.join(lines))
# Retain only evidence relevant to this audit; omit account and individual review content.
for record in raw:
    record['snapshot'] = focused_evidence(record['snapshot'])
    if record.get('finder_snapshot'):
        record['finder_snapshot'] = record['finder_snapshot'].split('- iframe')[0]
    if record.get('place_id_validation'):
        record['place_id_validation']['snapshot'] = focused_evidence(record['place_id_validation']['snapshot'])
(ROOT / 'google-audit-raw.json').write_text(json.dumps(raw, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(summary, ensure_ascii=False, indent=2))
