import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const files = [
  'README.md',
  'docs/research-project-decisions.md',
  'research/literature-2026-09-14/literature-review.md',
  'tools/build_research_report.py',
];
const contents = Object.fromEntries(files.map((path) => [path, readFileSync(path, 'utf8')]));

test('project narrative uses the current complete official period', () => {
  for (const [path, content] of Object.entries(contents)) {
    assert.match(content, /2025(?:-0?1| 年 0?1 月)/, `${path} should name the study start month`);
    assert.match(content, /2026(?:-0?8| 年 0?8 月)/, `${path} should name the current complete end month`);
  }
});

test('current research narrative has no participant A/B or SUS study claims', () => {
  for (const [path, content] of Object.entries(contents)) {
    assert.doesNotMatch(content, /SUS|基本介面 A|解釋介面 B|對照測試|使用性測試|比較基礎排名介面/,
      `${path} should not frame interface testing as part of this study`);
  }
});

test('report generator retains the five requested thesis chapters', () => {
  const report = contents['tools/build_research_report.py'];
  for (const chapter of ['第一章 緒論', '第二章 文獻探討', '第三章 研究方法', '第四章 研究結果', '第五章 結論討論及建議']) {
    assert.ok(report.includes(chapter), `report should contain ${chapter}`);
  }
});
