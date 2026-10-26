import { importLibrary } from '@googlemaps/js-api-loader';
import { configureGoogleMaps } from './google-maps-loader';

export interface PlacePhotoResult {
  src: string;
  googleMapsURI: string;
  authors: Array<{
    displayName: string;
    uri?: string;
    photoURI?: string;
  }>;
}

export interface PlacePhotoProvider {
  getPhoto(placeId: string): Promise<PlacePhotoResult | null>;
}

export class GooglePlacePhotoProvider implements PlacePhotoProvider {
  async getPhoto(placeId: string): Promise<PlacePhotoResult | null> {
    const { Place } = await importLibrary('places');
    const place = new Place({ id: placeId });
    await place.fetchFields({ fields: ['displayName', 'photos'] });
    const photo = place.photos?.[0];
    if (!photo) return null;

    return {
      src: photo.getURI({ maxWidth: 1600, maxHeight: 900 }),
      googleMapsURI: photo.googleMapsURI ?? '',
      authors: photo.authorAttributions.map((attribution) => ({
        displayName: attribution.displayName,
        uri: attribution.uri ?? undefined,
        photoURI: attribution.photoURI ?? undefined,
      })),
    };
  }
}

let provider: GooglePlacePhotoProvider | undefined;

export function getGooglePlacePhotoProvider(apiKey: string): GooglePlacePhotoProvider {
  if (!provider) {
    configureGoogleMaps(apiKey);
    provider = new GooglePlacePhotoProvider();
  }

  return provider;
}
