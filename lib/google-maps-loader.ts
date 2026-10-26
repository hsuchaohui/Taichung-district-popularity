import { setOptions } from '@googlemaps/js-api-loader';

let configuredApiKey: string | undefined;

export function configureGoogleMaps(apiKey: string) {
  if (!configuredApiKey) {
    setOptions({ key: apiKey, v: 'weekly', language: 'zh-TW', region: 'TW' });
    configuredApiKey = apiKey;
  } else if (configuredApiKey !== apiKey) {
    throw new Error('Google Maps JavaScript API loader is already configured');
  }
}
