'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { representativeStoresByDistrict } from '../data/representative-stores';
import {
  GoogleDistrictMapProvider,
  type DistrictMapProvider,
} from '../lib/google-district-map';
import type { District } from '../lib/types';

interface DistrictLocationProps {
  districts: District[];
  selectedDistrictId: string;
  selectedStorePlaceId?: string;
  onDistrictSelect: (districtId: string) => void;
  onStoreSelect: (placeId: string) => void;
  mapProvider?: DistrictMapProvider;
}

export function DistrictLocation({
  districts,
  selectedDistrictId,
  onDistrictSelect,
  onStoreSelect,
  mapProvider,
}: DistrictLocationProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const stores = useMemo(
    () => representativeStoresByDistrict[selectedDistrictId] ?? [],
    [selectedDistrictId],
  );
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';
  const legalUrlsReady = import.meta.env.VITE_PUBLIC_LEGAL_URLS_READY === 'true';
  const canLoadMap = Boolean(apiKey) && legalUrlsReady;
  const renderKey = selectedDistrictId;
  const [mapState, setMapState] = useState<{
    key: string;
    status: 'ready' | 'error';
    message?: string;
  }>();
  useEffect(() => {
    if (!canLoadMap || !mapContainer.current) return;

    let active = true;
    let destroy: (() => void) | undefined;
    const activeProvider = mapProvider ?? new GoogleDistrictMapProvider(apiKey);
    activeProvider.renderMap({
      container: mapContainer.current,
      districts,
      stores,
      selectedDistrictId,
      selectedStorePlaceId: undefined,
      onDistrictSelect,
      onStoreSelect,
    }).then((cleanup) => {
      if (!active) {
        cleanup();
        return;
      }
      destroy = cleanup;
      setMapState({ key: renderKey, status: 'ready' });
    }).catch((error: unknown) => {
      if (active) {
        setMapState({
          key: renderKey,
          status: 'error',
          message: error instanceof Error ? error.message : undefined,
        });
      }
    });

    return () => {
      active = false;
      destroy?.();
    };
  }, [apiKey, canLoadMap, districts, mapProvider, onDistrictSelect, onStoreSelect, renderKey,
    selectedDistrictId, stores]);

  const currentStatus = mapState?.key === renderKey ? mapState.status : undefined;

  return (
    <section
      id="location"
      className="location-section"
      aria-label="臺中四商圈位置概覽與互動地圖"
    >
      <div className="section-intro">
        <div>
          <p className="eyebrow">INTERACTIVE MAP</p>
          <h2 id="location-title">臺中四商圈互動地圖</h2>
        </div>
        <p>切換商圈並探索目前商圈的 10 家代表店家；點擊編號標記可查看最新 Google 評論。</p>
      </div>

      {canLoadMap ? (
        <div className="google-map-shell">
          <div ref={mapContainer} className="google-district-map"
            aria-label="臺中四商圈與代表店家互動地圖" />
          {!currentStatus ? <p className="map-loading" role="status">互動地圖載入中…</p> : null}
          {currentStatus === 'error' ? (
            <p className="map-loading map-error" role="alert">
              互動地圖目前無法載入，請稍後再試。
              {mapState?.message ? <small>{mapState.message}</small> : null}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="map-setup-message" role="status">
          互動地圖尚未設定，請先完成 Google Maps 瀏覽器金鑰設定。
        </p>
      )}

      <div className="map-district-controls" aria-label="選擇商圈">
        {districts.map((district) => (
          <button
            type="button"
            className="location-marker"
            aria-label={`在詳情查看${district.name}`}
            aria-pressed={district.id === selectedDistrictId}
            key={district.id}
            onClick={() => onDistrictSelect(district.id)}
          >
            {district.id === selectedDistrictId ? (
              <span className="location-selection-status" aria-hidden="true">✓ 已選取</span>
            ) : null}
            <strong>{district.shortName}</strong>
            <span>{district.location.label}</span>
          </button>
        ))}
      </div>
      <p className="map-legend">
        <span><i className="district-dot" aria-hidden="true" />商圈中心</span>
        <span><i className="store-dot" aria-hidden="true" />目前商圈代表店家</span>
      </p>
    </section>
  );
}
