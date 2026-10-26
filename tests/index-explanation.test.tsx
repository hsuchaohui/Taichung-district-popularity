import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IndexExplanation } from '../components/IndexExplanation';
import { loadStudyDataset } from '../lib/study-data';

describe('index explanation panel', () => {
  it('distinguishes stable and sensitive perturbation ranges', () => {
    render(<IndexExplanation studyData={loadStudyDataset()} month="2025-04" />);
    const table = screen.getByRole('table', { name: '2025年4月替代權重排名' });

    expect(within(table).getByRole('row', { name: /公益路商圈/ })).toHaveTextContent('穩健');
    expect(within(table).getByRole('row', { name: /一中商圈/ })).toHaveTextContent('敏感');
    expect(within(table).getByRole('row', { name: /逢甲商圈/ })).toHaveTextContent('敏感');
    expect(within(table).getByRole('row', { name: /草悟道/ })).toHaveTextContent('穩健');
  });

  it('states when a valid month has no flagged anomaly', () => {
    render(<IndexExplanation studyData={loadStudyDataset()} month="2026-04" />);

    expect(screen.getByRole('status', { name: '資料品質提醒' })).toHaveTextContent(
      '本月未觸發既定異常規則',
    );
  });

  it('shows an unavailable message instead of zeroes for a missing sensitivity month', () => {
    render(<IndexExplanation studyData={loadStudyDataset()} month="2099-01" />);

    expect(screen.getByRole('status')).toHaveTextContent('本月權重敏感度資料暫時無法取得');
    expect(screen.queryByText(/第 0 名|0\.0000 分/)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
