import { describe, expect, it } from 'vitest';
import { getSeriesStyles } from '../components/Comparison';

describe('comparison trend styles', () => {
  it('keeps a district style stable when an earlier district is removed', () => {
    const allDistrictIds = ['fengjia', 'yizhong', 'calligraphy', 'gongyi'];
    const beforeRemoval = getSeriesStyles(allDistrictIds);
    const afterRemoval = getSeriesStyles(allDistrictIds.slice(1));

    expect(afterRemoval.get('yizhong')).toEqual(beforeRemoval.get('yizhong'));
  });
});
