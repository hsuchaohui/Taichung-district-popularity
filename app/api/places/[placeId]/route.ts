import { NextResponse } from 'next/server';
import { isRepresentativePlaceId } from '../../../../data/representative-stores';
import { fetchGooglePlaceDetails } from '../../../../lib/google-place-details';

// Representative places are a fixed set; cache for a day to limit billed Places API calls.
const PLACES_CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';

export async function GET(
  _request: Request,
  context: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await context.params;

  if (!isRepresentativePlaceId(placeId)) {
    return NextResponse.json({ error: 'Unknown place' }, { status: 404 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Places API is not configured' }, { status: 503 });
  }

  try {
    const place = await fetchGooglePlaceDetails(placeId, apiKey);
    return NextResponse.json(place, {
      headers: { 'Cache-Control': PLACES_CACHE_CONTROL },
    });
  } catch {
    return NextResponse.json({ error: 'Places API request failed' }, { status: 502 });
  }
}
