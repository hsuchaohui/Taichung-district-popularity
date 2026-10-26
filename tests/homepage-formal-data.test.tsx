import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Page from '../app/page';

describe('public popularity index homepage', () => {
  it('shows the current formal dataset and index explanation on the homepage', () => {
    render(<Page />);

    expect(screen.getByText('正式官方資料｜研究估算指數')).toBeInTheDocument();
    expect(screen.getByLabelText('資料月份')).toHaveValue('2026-08');
    expect(screen.getByRole('heading', { name: '權重與排名敏感度解釋' })).toBeInTheDocument();
    expect(screen.getByText(/TCDPI-core-v1\.1\.0/)).toBeInTheDocument();
    expect(screen.queryByText(/示範資料/)).not.toBeInTheDocument();
    expect(screen.queryByText(/研究測試介面/)).not.toBeInTheDocument();
  });
});
