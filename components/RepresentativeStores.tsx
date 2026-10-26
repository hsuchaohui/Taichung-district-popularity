'use client';

import { useEffect, useState } from 'react';
import { representativeStoresByDistrict } from '../data/representative-stores';
import type { GooglePlaceDetails } from '../lib/google-place-details';

const businessStatusLabels: Record<string, string> = {
  OPERATIONAL: '營業中',
  CLOSED_TEMPORARILY: '暫時歇業',
  CLOSED_PERMANENTLY: '永久歇業',
};

interface RepresentativeStoresProps {
  districtId: string;
  selectedPlaceId?: string;
  onStoreSelect?: (placeId: string) => void;
}

export function RepresentativeStores({
  districtId,
  selectedPlaceId,
  onStoreSelect,
}: RepresentativeStoresProps) {
  const stores = representativeStoresByDistrict[districtId] ?? [];
  const [localSelectedPlaceId, setLocalSelectedPlaceId] = useState<string>();
  const activePlaceId = selectedPlaceId ?? localSelectedPlaceId;

  function selectStore(placeId: string) {
    setLocalSelectedPlaceId(placeId);
    onStoreSelect?.(placeId);
  }

  return (
    <section className="representative-stores" aria-labelledby="representative-stores-title">
      <div className="representative-stores-heading">
        <div>
          <p className="eyebrow">REPRESENTATIVE STORES</p>
          <h3 id="representative-stores-title">代表店家與 Google 評論</h3>
        </div>
        <span>共 {stores.length} 家</span>
      </div>

      <ol className="store-picker">
        {stores.map((store, index) => (
          <li key={store.placeId}>
            <button
              type="button"
              aria-pressed={activePlaceId === store.placeId}
              aria-label={`查看${store.name}最新 Google 評論`}
              onClick={() => selectStore(store.placeId)}
            >
              <span className="store-order">{String(index + 1).padStart(2, '0')}</span>
              <span className="store-name">{store.name}</span>
              <span className="store-category">{store.category}</span>
            </button>
          </li>
        ))}
      </ol>

      {activePlaceId ? <PlaceReviewLoader key={activePlaceId} placeId={activePlaceId} /> : null}
    </section>
  );
}

function PlaceReviewLoader({ placeId }: { placeId: string }) {
  const [details, setDetails] = useState<GooglePlaceDetails>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/places/${encodeURIComponent(placeId)}`, {
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error('Request failed');
        return response.json() as Promise<GooglePlaceDetails>;
      }).then((place) => {
        setDetails(place);
      }).catch(() => {
        if (!controller.signal.aborted) setError(true);
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [placeId]);

  return (
    <>
      {loading ? <p className="place-feedback" role="status">正在取得最新 Google 商家資料…</p> : null}
      {error ? (
        <p className="place-feedback place-error" role="alert">
          目前無法取得 Google 商家資料，請稍後再試。
        </p>
      ) : null}
      {details ? <PlaceReviewPanel place={details} /> : null}
    </>
  );
}

function PlaceReviewPanel({ place }: { place: GooglePlaceDetails }) {
  const reviews = place.reviews ?? [];
  const status = place.businessStatus
    ? businessStatusLabels[place.businessStatus] ?? place.businessStatus
    : '狀態未提供';

  return (
    <div className="place-review-panel" aria-live="polite">
      <div className="place-review-summary">
        <div>
          <span className={`business-status status-${place.businessStatus?.toLowerCase() ?? 'unknown'}`}>
            {status}
          </span>
          <h4>{place.displayName.text}</h4>
          {place.formattedAddress ? <p>{place.formattedAddress}</p> : null}
        </div>
        <div className="place-rating" aria-label={`Google 評分 ${place.rating ?? '未提供'}`}>
          <strong>{place.rating ?? '—'}</strong>
          <span>★ Google 評分</span>
          <small>{typeof place.userRatingCount === 'number'
            ? `${place.userRatingCount.toLocaleString('zh-TW')} 則評分`
            : '評分數未提供'}</small>
        </div>
      </div>

      <div className="google-attribution">
        <span translate="no">Google Maps</span>
        {place.googleMapsUri ? (
          <a href={place.googleMapsUri} target="_blank" rel="noreferrer">
            查看商家頁面
          </a>
        ) : null}
      </div>

      <p className="review-order-note">Google 評論依關聯性排序；Google 會在發現不實內容時移除。</p>

      {reviews.length ? (
        <ul className="google-review-list">
          {reviews.map((review) => (
            <li key={review.name}>
              <div className="review-author">
                {review.authorAttribution.photoUri ? (
                  // Google requires the API-provided author avatar; its host varies by reviewer.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={review.authorAttribution.photoUri}
                    alt={`${review.authorAttribution.displayName}的個人資料照片`}
                    width="36"
                    height="36"
                  />
                ) : null}
                <div>
                  {review.authorAttribution.uri ? (
                    <a href={review.authorAttribution.uri} target="_blank" rel="noreferrer">
                      {review.authorAttribution.displayName}
                    </a>
                  ) : <strong>{review.authorAttribution.displayName}</strong>}
                  <span>{'★'.repeat(Math.max(0, Math.min(5, review.rating)))}</span>
                </div>
                {review.relativePublishTimeDescription ? (
                  <time>{review.relativePublishTimeDescription}</time>
                ) : null}
              </div>
              {review.text?.text ? <p>{review.text.text}</p> : null}
              {review.googleMapsUri ? (
                <a className="review-source" href={review.googleMapsUri} target="_blank" rel="noreferrer">
                  在 Google Maps 查看這則評論
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="place-feedback">Google 目前未回傳可顯示的評論。</p>}
    </div>
  );
}
