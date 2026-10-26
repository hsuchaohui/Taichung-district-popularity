export interface GoogleReview {
  name: string;
  rating: number;
  relativePublishTimeDescription?: string;
  text?: { text: string; languageCode?: string };
  originalText?: { text: string; languageCode?: string };
  authorAttribution: {
    displayName: string;
    uri?: string;
    photoUri?: string;
  };
  googleMapsUri?: string;
}

export interface GooglePlaceDetails {
  id: string;
  displayName: { text: string; languageCode?: string };
  formattedAddress?: string;
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: GoogleReview[];
}

export interface GooglePlaceLocation {
  id: string;
  location: { latitude: number; longitude: number };
}

export async function fetchGooglePlaceLocation(
  placeId: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<GooglePlaceLocation> {
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  const response = await fetcher(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,location',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Places API request failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<GooglePlaceLocation>;
}

export async function fetchGooglePlaceDetails(
  placeId: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<GooglePlaceDetails> {
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set('languageCode', 'zh-TW');
  url.searchParams.set('regionCode', 'TW');

  const response = await fetcher(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'id',
        'displayName',
        'formattedAddress',
        'businessStatus',
        'rating',
        'userRatingCount',
        'googleMapsUri',
        'reviews',
      ].join(','),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Places API request failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<GooglePlaceDetails>;
}
