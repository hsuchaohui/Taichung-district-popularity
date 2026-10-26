import { describe, expect, it, vi } from 'vitest';
import { fetchGooglePlaceDetails, fetchGooglePlaceLocation } from '../lib/google-place-details';

describe('fetchGooglePlaceDetails', () => {
  it('requests only the fields needed by the review panel', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'place-1',
      displayName: { text: '測試店家' },
      businessStatus: 'OPERATIONAL',
      reviews: [],
    }), { status: 200 }));

    await fetchGooglePlaceDetails('place-1', 'secret-key', fetcher);

    const [url, options] = fetcher.mock.calls[0];
    expect(url.toString()).toContain('/v1/places/place-1');
    expect(url.searchParams.get('languageCode')).toBe('zh-TW');
    expect(url.searchParams.get('regionCode')).toBe('TW');
    expect(options.headers['X-Goog-Api-Key']).toBe('secret-key');
    expect(options.headers['X-Goog-FieldMask']).toBe(
      'id,displayName,formattedAddress,businessStatus,rating,userRatingCount,googleMapsUri,reviews',
    );
    expect(options.cache).toBe('no-store');
  });

  it('does not expose the API key when Google returns an error', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 }));

    await expect(fetchGooglePlaceDetails('place-1', 'secret-key', fetcher))
      .rejects.toThrow('Places API request failed with HTTP 403');
  });

  it('requests only location fields for map markers', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'place-1',
      location: { latitude: 24.15, longitude: 120.67 },
    }), { status: 200 }));

    await fetchGooglePlaceLocation('place-1', 'secret-key', fetcher);

    const [, options] = fetcher.mock.calls[0];
    expect(options.headers['X-Goog-FieldMask']).toBe('id,location');
  });
});
