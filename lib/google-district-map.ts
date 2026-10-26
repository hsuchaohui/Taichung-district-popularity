import { importLibrary } from '@googlemaps/js-api-loader';
import type { RepresentativeStore } from '../data/representative-stores';
import type { District } from './types';
import { configureGoogleMaps } from './google-maps-loader';
import type { GooglePlaceLocation } from './google-place-details';

export interface DistrictMapOptions {
  container: HTMLElement;
  districts: District[];
  stores: RepresentativeStore[];
  selectedDistrictId: string;
  selectedStorePlaceId?: string;
  onDistrictSelect: (districtId: string) => void;
  onStoreSelect: (placeId: string) => void;
}

export interface DistrictMapProvider {
  renderMap(options: DistrictMapOptions): Promise<() => void>;
}

export class GoogleDistrictMapProvider implements DistrictMapProvider {
  constructor(private readonly apiKey: string) {
    configureGoogleMaps(apiKey);
  }

  async renderMap(options: DistrictMapOptions): Promise<() => void> {
    const [mapsLibrary, markerLibrary] = await Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
    ]);
    const { Map, InfoWindow } = mapsLibrary;
    const { AdvancedMarkerElement, PinElement } = markerLibrary;
    const selectedDistrict = options.districts.find(
      (district) => district.id === options.selectedDistrictId,
    ) ?? options.districts[0];
    const map = new Map(options.container, {
      center: selectedDistrict?.location ?? { lat: 24.16, lng: 120.67 },
      zoom: 15,
      mapId: 'DEMO_MAP_ID',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'cooperative',
    });
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];
    const storePins: google.maps.marker.PinElement[] = [];
    const infoWindow = new InfoWindow();

    for (const district of options.districts) {
      const selected = district.id === options.selectedDistrictId;
      const pin = new PinElement({
        background: selected ? '#123f3a' : '#dff1ed',
        borderColor: '#123f3a',
        glyphColor: selected ? '#ffffff' : '#123f3a',
        glyphText: district.shortName,
        scale: selected ? 1.25 : 1,
      });
      const marker = new AdvancedMarkerElement({
        map,
        position: district.location,
        title: district.name,
        content: pin,
        gmpClickable: true,
        zIndex: selected ? 20 : 10,
      });
      marker.addEventListener('gmp-click', () => options.onDistrictSelect(district.id));
      markers.push(marker);
    }

    const places = await Promise.all(options.stores.map(async (store) => {
      const response = await fetch(`/api/places/${encodeURIComponent(store.placeId)}/location`);
      if (!response.ok) throw new Error(`Place location request failed with HTTP ${response.status}`);
      const place = await response.json() as GooglePlaceLocation;
      return {
        store,
        location: { lat: place.location.latitude, lng: place.location.longitude },
      };
    }));

    const points = [
      ...options.districts.map((district) => district.location),
      ...places.map(({ location }) => location),
    ];
    map.fitBounds({
      north: Math.max(...points.map(({ lat }) => lat)),
      south: Math.min(...points.map(({ lat }) => lat)),
      east: Math.max(...points.map(({ lng }) => lng)),
      west: Math.min(...points.map(({ lng }) => lng)),
    }, 56);

    for (const [index, { store, location }] of places.entries()) {
      if (!location) continue;
      const selected = store.placeId === options.selectedStorePlaceId;
      const pin = new PinElement({
        background: selected ? '#c65a32' : '#168477',
        borderColor: '#ffffff',
        glyphColor: '#ffffff',
        glyphText: String(index + 1),
        scale: selected ? 1.2 : 0.9,
      });
      const marker = new AdvancedMarkerElement({
        map,
        position: location,
        title: store.name,
        content: pin,
        gmpClickable: true,
        zIndex: selected ? 40 : 30,
      });
      marker.addEventListener('gmp-click', () => {
        storePins.forEach((storePin) => {
          storePin.background = '#168477';
          storePin.scale = 0.9;
        });
        pin.background = '#c65a32';
        pin.scale = 1.2;
        options.onStoreSelect(store.placeId);
        const content = document.createElement('div');
        content.className = 'map-info-window';
        const name = document.createElement('strong');
        name.textContent = store.name;
        const category = document.createElement('span');
        category.textContent = store.category;
        const action = document.createElement('button');
        action.type = 'button';
        action.textContent = '查看最新 Google 評論';
        action.addEventListener('click', () => {
          options.onStoreSelect(store.placeId);
          document.getElementById('representative-stores-title')?.scrollIntoView({ behavior: 'smooth' });
        });
        content.append(name, category, action);
        infoWindow.setContent(content);
        infoWindow.open({ map, anchor: marker });
      });
      storePins.push(pin);
      markers.push(marker);
    }

    return () => {
      infoWindow.close();
      markers.forEach((marker) => { marker.map = null; });
    };
  }
}
