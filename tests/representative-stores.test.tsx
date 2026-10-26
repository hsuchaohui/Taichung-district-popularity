import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepresentativeStores } from '../components/RepresentativeStores';
import {
  isRepresentativePlaceId,
  representativeStoresByDistrict,
} from '../data/representative-stores';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('representative store data', () => {
  it('provides ten stores for every research district and unique Place IDs', () => {
    const groups = Object.values(representativeStoresByDistrict);
    const placeIds = groups.flatMap((stores) => stores.map((store) => store.placeId));

    expect(groups).toHaveLength(4);
    expect(groups.every((stores) => stores.length === 10)).toBe(true);
    expect(new Set(placeIds).size).toBe(40);
    expect(placeIds.every(isRepresentativePlaceId)).toBe(true);
  });
});

describe('RepresentativeStores', () => {
  it('loads current Google details only after a store is selected', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'ChIJRw_ShSEWaTQRJOy8z1Z6woI',
      displayName: { text: '明倫蛋餅 逢甲福星店', languageCode: 'zh-TW' },
      formattedAddress: '407台中市西屯區福星路546號',
      businessStatus: 'OPERATIONAL',
      rating: 3.7,
      userRatingCount: 3341,
      googleMapsUri: 'https://maps.google.com/store',
      reviews: [{
        name: 'places/store/reviews/review-1',
        rating: 5,
        relativePublishTimeDescription: '2 週前',
        text: { text: '蛋餅口感很好。', languageCode: 'zh-TW' },
        authorAttribution: {
          displayName: '王小明',
          uri: 'https://maps.google.com/profile',
          photoUri: 'https://maps.google.com/avatar',
        },
        googleMapsUri: 'https://maps.google.com/review',
      }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<RepresentativeStores districtId="fengjia" />);

    expect(screen.getAllByRole('button', { name: /查看.*最新 Google 評論/ })).toHaveLength(10);
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', {
      name: '查看明倫蛋餅 逢甲福星店最新 Google 評論',
    }));

    expect(await screen.findByText('營業中')).toBeInTheDocument();
    expect(screen.getByText('3.7')).toBeInTheDocument();
    expect(screen.getByText('3,341 則評分')).toBeInTheDocument();
    expect(screen.getByText('蛋餅口感很好。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '王小明' })).toHaveAttribute(
      'href',
      'https://maps.google.com/profile',
    );
    expect(screen.getByRole('link', { name: '在 Google Maps 查看這則評論' })).toHaveAttribute(
      'href',
      'https://maps.google.com/review',
    );
    expect(screen.getByText('Google Maps', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/依關聯性排序/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/places/ChIJRw_ShSEWaTQRJOy8z1Z6woI',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('shows a useful error when current details cannot be loaded', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));

    render(<RepresentativeStores districtId="fengjia" />);
    await user.click(screen.getByRole('button', {
      name: '查看明倫蛋餅 逢甲福星店最新 Google 評論',
    }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '目前無法取得 Google 商家資料，請稍後再試。',
    );
  });
});
