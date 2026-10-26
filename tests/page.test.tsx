import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Page, { PageShell } from '../app/page';
import { Comparison } from '../components/Comparison';
import { DistrictDetail } from '../components/DistrictDetail';
import { Ranking } from '../components/Ranking';
import { loadDemoDataset } from '../lib/data';
import { safelyLoadStudyDataset } from '../lib/study-data';

describe('research prototype page', () => {
  it('keeps the hero, methodology, sources, and limitations readable when dataset validation fails', () => {
    const datasetResult = safelyLoadStudyDataset(() => { throw new Error('invalid formal source'); });
    render(<PageShell datasetResult={datasetResult} />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('正式資料暫時無法讀取');
    const methodology = screen.getByRole('region', { name: '研究方法與資料界線' });
    expect(within(methodology).getByRole('heading', { name: '資料來源' })).toBeInTheDocument();
    expect(within(methodology).getByRole('heading', { name: '使用限制' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /熱門排行榜/ })).not.toBeInTheDocument();
  });

  it('defaults to the latest month and renders all research scope summaries', () => {
    render(<Page />);
    const hero = screen.getByRole('banner');

    expect(screen.getByLabelText('資料月份')).toHaveValue('2026-08');
    expect(screen.getByRole('heading', { name: '2026年8月熱門排行榜' })).toBeInTheDocument();
    expect(within(hero).getByText('4 個核心商圈')).toBeInTheDocument();
    expect(within(hero).getByText('20 個共同月份')).toBeInTheDocument();
    expect(within(hero).getByText('3 個指數構面')).toBeInTheDocument();
  });

  it('provides page landmarks and matching targets for every primary navigation link', () => {
    const { container } = render(<Page />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect([...container.children].map((element) => element.tagName)).toEqual([
      'HEADER',
      'MAIN',
      'FOOTER',
    ]);
    const navigation = screen.getByRole('navigation', { name: '主要導覽' });
    const expectedTargets = [
      ['本月排名', '#ranking'],
      ['商圈比較', '#comparison'],
      ['位置概覽', '#location'],
      ['研究方法', '#methodology'],
    ] as const;

    for (const [name, target] of expectedTargets) {
      expect(within(navigation).getByRole('link', { name })).toHaveAttribute('href', target);
      expect(document.querySelector(target)).not.toBeNull();
    }
  });

  it('labels scores as formal data and changes the selected month', async () => {
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getAllByText(/正式資料/).length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText('資料月份'), '2025-01');
    expect(screen.getByText('2025年1月熱門排行榜')).toBeInTheDocument();
  });

  it('describes first-month rank context as having no prior month', async () => {
    const user = userEvent.setup();
    render(<Page />);

    await user.selectOptions(screen.getByLabelText('資料月份'), '2025-01');
    const ranking = screen.getByRole('region', { name: /熱門排行榜/ });
    expect(within(ranking).getAllByText('無前月可比較')).toHaveLength(4);
  });

  it('reserves the unavailable message for an actually missing ranking row', () => {
    const data = loadDemoDataset();
    const district = data.districts[0];
    const row = {
      ...data.monthlyMetrics.find((metric) => metric.districtId === district.id)!,
      rank: null,
      rankChange: null,
      dataStatus: 'missing' as const,
    };
    render(
      <Ranking
        districts={[district]}
        months={[row.month]}
        ranking={[row]}
        selectedMonth={row.month}
        selectedDistrictId={district.id}
        onMonthChange={() => undefined}
        onDistrictSelect={() => undefined}
      />,
    );
    expect(screen.getAllByText('本月資料尚未提供').length).toBeGreaterThan(0);
    expect(screen.queryByText('無前月可比較')).not.toBeInTheDocument();
  });

  it('renders one accessible ranking button for each research district', () => {
    render(<Page />);
    const ranking = screen.getByRole('region', { name: /熱門排行榜/ });

    expect(within(ranking).getAllByRole('button', { name: /^查看/ })).toHaveLength(4);
  });

  it('selects a district from the ranking and updates detail heading', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const ranking = screen.getByRole('region', { name: /熱門排行榜/ });
    await user.click(within(ranking).getByRole('button', { name: '查看一中商圈' }));
    expect(screen.getByRole('heading', { name: '一中商圈指標詳情' })).toBeInTheDocument();
  });

  it('shows visible non-color selected markers for ranking and location controls', () => {
    render(<Page />);
    const ranking = screen.getByRole('region', { name: /熱門排行榜/ });
    const selectedRow = within(ranking).getByRole('button', { pressed: true });
    const selectedLocation = within(
      screen.getByRole('region', { name: /臺中四商圈位置概覽/ }),
    ).getByRole('button', { pressed: true });

    expect(within(selectedRow).getByText('✓ 目前選取')).toBeVisible();
    expect(selectedLocation).toHaveTextContent('✓');
  });

  it('keeps rank movement labels visible in markup and mobile styles', () => {
    render(<Page />);
    const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

    expect(screen.getAllByText(/上升|下降|持平/).length).toBeGreaterThan(0);
    expect(css).not.toMatch(/\.rank-movement\s*\{[^}]*display\s*:\s*none/);
  });

  it('keeps the rejected comparison checkbox selected and announces why', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const comparison = screen.getByRole('region', { name: /多商圈趨勢與構面比較/ });
    const toggles = within(comparison).getAllByRole('checkbox', { name: /加入比較/ });

    await user.click(toggles[0]);
    await user.click(toggles[1]);
    await user.click(toggles[2]);

    expect(screen.getByText('至少保留兩個商圈進行比較')).toBeInTheDocument();
    expect(toggles[2]).toBeChecked();
  });

  it('gives every comparison control an accessible district name', () => {
    render(<Page />);
    const comparison = screen.getByRole('region', { name: /多商圈趨勢與構面比較/ });

    for (const district of ['逢甲商圈', '一中商圈', '草悟道', '公益路商圈']) {
      expect(within(comparison).getByRole('checkbox', { name: `加入比較：${district}` })).toBeInTheDocument();
    }
  });

  it('renders 20 semantic month rows and exactly three component groups', () => {
    render(<Page />);
    const table = screen.getByRole('table', { name: /熱門指數趨勢文字資料/ });

    expect(table.querySelectorAll('tbody tr')).toHaveLength(20);
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(3);
    expect(screen.getByRole('heading', { level: 4, name: '吸引力' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: '投入度' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: '黏著度' })).toBeInTheDocument();
  });

  it('shows missing text and zero-width detail bars without presenting nulls as zero', () => {
    const data = loadDemoDataset();
    const district = data.districts[0];
    const missingMetric = {
      ...data.monthlyMetrics.find((row) => row.districtId === district.id)!,
      visitors: null,
      stayMinutes: null,
      revisitRate: null,
      attractionScore: null,
      engagementScore: null,
      loyaltyScore: null,
      popularityScore: null,
      rank: null,
      rankChange: null,
      dataStatus: 'missing' as const,
    };

    render(
      <DistrictDetail
        district={district}
        metric={missingMetric}
        comparisonSelected
        comparisonSelectionLocked={false}
        onComparisonChange={() => undefined}
      />,
    );

    expect(screen.getAllByText('本月資料尚未提供')).toHaveLength(6);
    for (const bar of screen.getAllByRole('progressbar')) {
      expect(bar).toHaveAttribute('aria-valuetext', '本月資料尚未提供');
      expect(within(bar).getByText('', { selector: '.component-bar' })).toHaveStyle({ width: '0%' });
    }
    expect(screen.queryByText(/^0 (?:人|分鐘|%|分)$/)).not.toBeInTheDocument();
  });

  it('uses the exact missing message throughout comparison without printing numeric zero', () => {
    const data = loadDemoDataset();
    const selectedDistricts = data.districts.slice(0, 2);
    const comparisonIds = selectedDistricts.map((district) => district.id);
    const comparisonRows = data.monthlyMetrics
      .filter((row) => comparisonIds.includes(row.districtId))
      .map((row) => row.month === data.metadata.periodEnd && row.districtId === comparisonIds[0]
        ? {
            ...row,
            attractionScore: null,
            engagementScore: null,
            loyaltyScore: null,
            popularityScore: null,
            dataStatus: 'missing' as const,
          }
        : row);
    const { container } = render(
      <Comparison
        districts={data.districts}
        comparisonIds={comparisonIds}
        comparisonRows={comparisonRows}
        selectedMonth={data.metadata.periodEnd}
        selectionMessage=""
        onComparisonChange={() => undefined}
      />,
    );
    const table = screen.getByRole('table');
    const componentCard = container.querySelector('.component-comparison');

    expect(componentCard).not.toBeNull();
    expect(within(table).getAllByText('本月資料尚未提供')).toHaveLength(1);
    expect(within(componentCard as HTMLElement).getAllByText('本月資料尚未提供')).toHaveLength(3);
    expect(screen.queryByText('資料尚未提供')).not.toBeInTheDocument();
    expect(screen.queryByText(/^0(?:\.0)? 分$/)).not.toBeInTheDocument();
  });

  it('labels both comparison score surfaces as formal data', () => {
    render(<Page />);
    const comparison = screen.getByRole('region', { name: /多商圈趨勢與構面比較/ });
    const table = within(comparison).getByRole('table');
    const componentCard = comparison.querySelector('.component-comparison');

    expect(within(table).getByText('熱門指數趨勢文字資料（正式資料）')).toBeInTheDocument();
    expect(componentCard).not.toBeNull();
    expect(within(componentCard as HTMLElement).getByRole('heading', {
      level: 3,
      name: /2026\/8 構面比較（正式資料）/,
    })).toBeInTheDocument();
  });

  it('selects a district from the location overview', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: '在詳情查看草悟道' }));
    expect(screen.getByRole('heading', { name: '草悟道指標詳情' })).toBeInTheDocument();
  });

  it('documents the complete methodology contract and research limitations', () => {
    render(<Page />);
    const methodology = screen.getByRole('region', { name: '研究方法與資料界線' });

    expect(within(methodology).getByText('TCDPI = 0.40 × 吸引力 + 0.30 × 投入度 + 0.30 × 黏著度')).toBeInTheDocument();
    expect(methodology).toHaveTextContent('log(1 + visitors)');
    expect(methodology).toHaveTextContent('1/99 百分位縮尾');
    expect(methodology).toHaveTextContent('凍結的 min-max 基準期');
    expect(methodology).toHaveTextContent('等權重與熵權重');
    expect(within(methodology).getByRole('link', { name: '臺中市主要遊憩據點遊客行為資訊網' })).toHaveAttribute(
      'href',
      'https://tourstats.taichung.gov.tw/',
    );
    expect(methodology).toHaveTextContent('9–10 月官方三項指標尚未完整');
  });

  it('gives every rendered image a non-empty accessible description', () => {
    render(<Page />);

    for (const image of screen.getAllByRole('img')) {
      expect(image.getAttribute('alt') || image.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('links to the Google disclosure routes from the footer', () => {
    render(<Page />);

    expect(screen.getByRole('link', { name: '使用條款' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: '隱私權說明' })).toHaveAttribute('href', '/privacy');
  });

  it('shows licensed district fallbacks in the hero, ranking, and selected detail', () => {
    render(<Page />);
    const hero = screen.getByRole('banner');
    const ranking = screen.getByRole('region', { name: /熱門排行榜/ });
    const detail = screen.getByRole('region', { name: /指標詳情/ });

    expect(within(hero).getByRole('img', { name: '逢甲夜市夜間街景' })).toBeInTheDocument();
    expect(within(ranking).getByRole('img', { name: '公益路街景' })).toBeInTheDocument();
    expect(within(detail).getByRole('img', { name: '公益路街景' })).toBeInTheDocument();
  });
});

describe('responsive and keyboard CSS contract', () => {
  const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');
  const mobileCss = css.slice(
    css.indexOf('@media (max-width: 760px)'),
    css.indexOf('@media (prefers-reduced-motion: reduce)'),
  );

  function declarationsFor(selector: string) {
    return [...mobileCss.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
      .filter((match) => match[1].split(',').map((item) => item.trim()).includes(selector))
      .map((match) => match[2])
      .join('\n');
  }

  it('uses the required 760px mobile breakpoint with one-column cards', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)/);
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*\.methodology-grid[\s\S]*grid-template-columns:\s*1fr/);
  });

  it('keeps main mobile controls at least 44px tall', () => {
    expect(css).toMatch(/\.ranking-row\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.comparison-options label\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.location-marker\s*\{[^}]*min-height:\s*44px/);
  });

  it('keeps every secondary mobile link category at least 44px tall', () => {
    for (const selector of [
      '.wordmark',
      '.district-photo-credit a',
      '.methodology-grid a',
      '.site-footer a',
      '.legal-page a',
    ]) {
      expect(declarationsFor(selector)).toMatch(/display:\s*(?:inline-)?flex/);
      expect(declarationsFor(selector)).toMatch(/min-height:\s*44px/);
    }
  });

  it('contains charts and tables without body overflow', () => {
    expect(css).toMatch(/body\s*\{[^}]*overflow-x:\s*clip/);
    expect(css).toMatch(/\.trend-chart\s*\{[^}]*max-width:\s*100%/);
    expect(css).toMatch(/\.trend-table-wrap\s*\{[^}]*overflow-x:\s*auto/);
  });

  it('provides visible keyboard focus and removes motion when requested', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*animation-duration:\s*0\.01ms/);
  });

  it('uses a dark photo text overlay and a non-color location selection cue', () => {
    expect(css).toMatch(/\.district-photo-credit\s*\{[^}]*background:\s*linear-gradient\([^;]+\/\s*0\.8/);
    expect(css).toMatch(/\.location-selection-status\s*\{[^}]*border:/);
  });
});
