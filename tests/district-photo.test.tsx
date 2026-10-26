import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { importLibrary } from '@googlemaps/js-api-loader';
import { DistrictPhoto } from '../components/DistrictPhoto';
import { districtPhotoById } from '../data/districts';
import {
  GooglePlacePhotoProvider,
  type PlacePhotoProvider,
  type PlacePhotoResult,
} from '../lib/google-place-photo';

vi.mock('@googlemaps/js-api-loader', () => ({
  importLibrary: vi.fn(),
  setOptions: vi.fn(),
}));

const googlePhoto: PlacePhotoResult = {
  src: 'https://maps.googleapis.com/example',
  googleMapsURI: 'https://maps.google.com/example',
  authors: [
    {
      displayName: '測試作者',
      uri: 'https://maps.google.com/profile',
      photoURI: 'https://maps.google.com/avatar',
    },
    {
      displayName: '共同作者',
      uri: 'https://maps.google.com/coauthor',
    },
  ],
};

function makeProvider(result: PlacePhotoResult | null = googlePhoto): PlacePhotoProvider {
  return { getPhoto: vi.fn().mockResolvedValue(result) };
}

const requiredProps = {
  districtId: 'fengjia',
  placeId: 'place-1',
  alt: '逢甲商圈街景',
  fallbackSrc: '/fallback.jpg',
  fallbackCredit: '開放授權示意圖',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('DistrictPhoto', () => {
  it('shows Google and author attribution only after all runtime gates pass', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    vi.stubEnv('VITE_PUBLIC_LEGAL_URLS_READY', 'true');
    const provider = makeProvider();

    render(<DistrictPhoto {...requiredProps} provider={provider} googleEnabled />);

    expect(screen.getByRole('status')).toHaveTextContent('載入商圈照片');
    expect(await screen.findByRole('link', { name: '測試作者' })).toHaveAttribute(
      'href',
      'https://maps.google.com/profile',
    );
    expect(screen.getByRole('link', { name: /在 Google Maps 查看照片/ })).toHaveAttribute(
      'href',
      'https://maps.google.com/example',
    );
    expect(screen.getByRole('link', { name: '共同作者' })).toHaveAttribute(
      'href',
      'https://maps.google.com/coauthor',
    );
    const brand = screen.getByText('Google Maps', { exact: true });
    expect(brand).toHaveAttribute('translate', 'no');
    expect(brand.tagName).toBe('SPAN');
    expect(screen.getByRole('img', { name: '測試作者的個人資料照片' })).toHaveAttribute(
      'src',
      'https://maps.google.com/avatar',
    );
    expect(provider.getPhoto).toHaveBeenCalledWith('place-1');
  });

  it.each([
    ['feature switch is off', false, 'test-key', 'true', 'place-1'],
    ['API key is empty', true, '', 'true', 'place-1'],
    ['legal routes are not ready', true, 'test-key', 'false', 'place-1'],
    ['place ID is empty', true, 'test-key', 'true', ''],
  ])('uses fallback without calling Google when %s', (_label, googleEnabled, apiKey, legalReady, placeId) => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', apiKey);
    vi.stubEnv('VITE_PUBLIC_LEGAL_URLS_READY', legalReady);
    const provider = makeProvider();

    render(
      <DistrictPhoto
        {...requiredProps}
        placeId={placeId}
        provider={provider}
        googleEnabled={googleEnabled}
      />,
    );

    expect(screen.getByText('開放授權示意圖')).toBeInTheDocument();
    expect(provider.getPhoto).not.toHaveBeenCalled();
  });

  it.each([
    ['provider rejects', makeProvider(), true],
    ['provider returns no photo', makeProvider(null), false],
    [
      'Google Maps source link is missing',
      makeProvider({ ...googlePhoto, googleMapsURI: '' }),
      false,
    ],
    [
      'author attribution is missing',
      makeProvider({ ...googlePhoto, authors: [] }),
      false,
    ],
    [
      'one of several author attributions is incomplete',
      makeProvider({
        ...googlePhoto,
        authors: [...googlePhoto.authors, { displayName: '缺連結作者' }],
      }),
      false,
    ],
  ])('falls back when %s', async (_label, provider, rejects) => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    vi.stubEnv('VITE_PUBLIC_LEGAL_URLS_READY', 'true');
    if (rejects) {
      vi.mocked(provider.getPhoto).mockRejectedValueOnce(new Error('offline'));
    }

    render(<DistrictPhoto {...requiredProps} provider={provider} googleEnabled />);

    expect(await screen.findByText('開放授權示意圖')).toBeInTheDocument();
  });

  it('falls back when the Google image cannot be displayed', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    vi.stubEnv('VITE_PUBLIC_LEGAL_URLS_READY', 'true');

    render(<DistrictPhoto {...requiredProps} provider={makeProvider()} googleEnabled />);
    const image = await screen.findByRole('img', { name: '逢甲商圈街景' });
    fireEvent.error(image);

    await waitFor(() => {
      expect(screen.getByText('開放授權示意圖')).toBeInTheDocument();
    });
  });

  it('falls back when provider.getPhoto throws synchronously', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    vi.stubEnv('VITE_PUBLIC_LEGAL_URLS_READY', 'true');
    const provider: PlacePhotoProvider = {
      getPhoto: vi.fn(() => {
        throw new Error('synchronous setup failure');
      }),
    };

    render(<DistrictPhoto {...requiredProps} provider={provider} googleEnabled />);

    expect(await screen.findByText('開放授權示意圖')).toBeInTheDocument();
  });

  it('uses a neutral district placeholder when the local fallback image is broken', () => {
    render(<DistrictPhoto {...requiredProps} googleEnabled={false} />);
    fireEvent.error(screen.getByRole('img', { name: '逢甲商圈街景' }));

    const placeholder = screen.getByRole('img', { name: '逢甲商圈街景' });
    expect(placeholder.tagName).toBe('DIV');
    expect(screen.getByText('開放授權示意圖')).toBeInTheDocument();
  });
});

describe('GooglePlacePhotoProvider', () => {
  it('preserves every author attribution returned for a photo', async () => {
    const fetchFields = vi.fn().mockResolvedValue(undefined);
    class FakePlace {
      photos = [{
        getURI: () => 'https://maps.googleapis.com/photo',
        googleMapsURI: 'https://maps.google.com/photo',
        authorAttributions: [
          { displayName: '作者甲', uri: 'https://maps.google.com/a', photoURI: null },
          { displayName: '作者乙', uri: 'https://maps.google.com/b', photoURI: 'https://maps.google.com/b.jpg' },
        ],
      }];

      fetchFields = fetchFields;
    }
    vi.mocked(importLibrary).mockResolvedValue({ Place: FakePlace } as never);

    const result = await new GooglePlacePhotoProvider().getPhoto('place-1');

    expect(result?.authors).toEqual([
      { displayName: '作者甲', uri: 'https://maps.google.com/a', photoURI: undefined },
      { displayName: '作者乙', uri: 'https://maps.google.com/b', photoURI: 'https://maps.google.com/b.jpg' },
    ]);
    expect(fetchFields).toHaveBeenCalledWith({ fields: ['displayName', 'photos'] });
  });
});

describe('photo attribution styles', () => {
  const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

  it('never hides ranking photo attribution at a mobile breakpoint', () => {
    expect(css).not.toMatch(
      /\.ranking-photo\s+\.district-photo-credit\s*\{[^}]*display\s*:\s*none/,
    );
  });

  it('renders the Google Maps text treatment at normal weight and at least 12px', () => {
    expect(css).toMatch(/\.google-maps-brand\s*\{[^}]*font-size\s*:\s*12px/);
    expect(css).toMatch(/\.google-maps-brand\s*\{[^}]*font-weight\s*:\s*400/);
  });
});

describe('district fallback photos', () => {
  it('provides complete open-license attribution for all four research districts', () => {
    expect(Object.keys(districtPhotoById).sort()).toEqual([
      'calligraphy',
      'fengjia',
      'gongyi',
      'yizhong',
    ]);

    for (const photo of Object.values(districtPhotoById)) {
      expect(photo.fallback.src).toMatch(/^\/districts\/.+\.jpg$/);
      expect(photo.fallback.author).not.toBe('');
      expect(photo.fallback.filePageUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(photo.fallback.license).toMatch(/^CC BY-SA/);
      expect(photo.fallback.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\/licenses\/by-sa\//);
    }
  });
});
