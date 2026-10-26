'use client';

/* eslint-disable @next/next/no-img-element -- Google photo URIs are ephemeral and fallback errors must be handled uniformly. */

import { useEffect, useState } from 'react';
import {
  getGooglePlacePhotoProvider,
  type PlacePhotoProvider,
  type PlacePhotoResult,
} from '../lib/google-place-photo';

interface DistrictPhotoProps {
  districtId: string;
  placeId?: string;
  alt: string;
  fallbackSrc?: string;
  fallbackCredit: string;
  fallbackCreditUrl?: string;
  fallbackLicense?: string;
  fallbackLicenseUrl?: string;
  provider?: PlacePhotoProvider;
  googleEnabled?: boolean;
  className?: string;
}

function getGoogleRuntimeConfig() {
  return {
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '',
    legalUrlsReady: import.meta.env.VITE_PUBLIC_LEGAL_URLS_READY === 'true',
  };
}

function hasRequiredAttribution(photo: PlacePhotoResult | null): photo is PlacePhotoResult & {
  authors: Array<PlacePhotoResult['authors'][number] & { uri: string }>;
} {
  return Boolean(
    photo?.src
      && photo.googleMapsURI
      && photo.authors.length > 0
      && photo.authors.every((author) => author.displayName && author.uri),
  );
}

export function DistrictPhoto({
  districtId,
  placeId,
  alt,
  fallbackSrc,
  fallbackCredit,
  fallbackCreditUrl,
  fallbackLicense,
  fallbackLicenseUrl,
  provider,
  googleEnabled = false,
  className = '',
}: DistrictPhotoProps) {
  const { apiKey, legalUrlsReady } = getGoogleRuntimeConfig();
  const normalizedPlaceId = placeId?.trim() ?? '';
  const canLoadGoogle = googleEnabled && Boolean(normalizedPlaceId) && Boolean(apiKey) && legalUrlsReady;
  const loadKey = canLoadGoogle ? `${districtId}:${normalizedPlaceId}` : '';
  const [resolution, setResolution] = useState<{
    loadKey: string;
    photo: PlacePhotoResult | null;
  }>({ loadKey: '', photo: null });
  const [failedFallbackSrc, setFailedFallbackSrc] = useState<string | undefined>();

  useEffect(() => {
    if (!canLoadGoogle) {
      return;
    }

    let active = true;
    Promise.resolve().then(() => {
      const activeProvider = provider ?? getGooglePlacePhotoProvider(apiKey);
      return activeProvider.getPhoto(normalizedPlaceId);
    }).then(
      (result) => {
        if (active) {
          setResolution({
            loadKey,
            photo: hasRequiredAttribution(result) ? result : null,
          });
        }
      },
      () => {
        if (active) setResolution({ loadKey, photo: null });
      },
    );

    return () => {
      active = false;
    };
  }, [apiKey, canLoadGoogle, loadKey, normalizedPlaceId, provider]);

  const classes = ['district-photo', className].filter(Boolean).join(' ');
  const state = !canLoadGoogle
    ? 'fallback'
    : resolution.loadKey !== loadKey
      ? 'loading'
      : resolution.photo
        ? 'google'
        : 'fallback';
  const photo = resolution.loadKey === loadKey ? resolution.photo : null;
  const fallbackImageAvailable = Boolean(fallbackSrc) && failedFallbackSrc !== fallbackSrc;

  if (state === 'loading') {
    return (
      <figure className={`${classes} district-photo-loading`} data-district-id={districtId}>
        <div role="status">載入商圈照片中…</div>
      </figure>
    );
  }

  if (state === 'google' && photo) {
    return (
      <figure className={classes} data-district-id={districtId}>
        <img src={photo.src} alt={alt} onError={() => setResolution({ loadKey, photo: null })} />
        <figcaption className="district-photo-credit google-photo-credit">
          <span className="google-maps-brand" translate="no">Google Maps</span>
          <span className="google-photo-authors">
            {photo.authors.map((author) => (
              <span className="google-photo-author" key={`${author.uri}-${author.displayName}`}>
                {author.photoURI ? (
                  <img src={author.photoURI} alt={`${author.displayName}的個人資料照片`} />
                ) : null}
                <a href={author.uri} rel="noreferrer">{author.displayName}</a>
              </span>
            ))}
          </span>
          <a href={photo.googleMapsURI} rel="noreferrer">在 Google Maps 查看照片</a>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={`${classes} district-photo-fallback`} data-district-id={districtId}>
      {fallbackImageAvailable ? (
        <img src={fallbackSrc} alt={alt} onError={() => setFailedFallbackSrc(fallbackSrc)} />
      ) : (
        <div className="district-photo-placeholder" role="img" aria-label={alt} />
      )}
      <figcaption className="district-photo-credit">
        {fallbackCreditUrl ? (
          <a href={fallbackCreditUrl} rel="noreferrer">{fallbackCredit}</a>
        ) : fallbackCredit}
        {fallbackLicense ? <span aria-hidden="true"> · </span> : null}
        {fallbackLicenseUrl && fallbackLicense ? (
          <a href={fallbackLicenseUrl} rel="noreferrer">{fallbackLicense}</a>
        ) : fallbackLicense}
      </figcaption>
    </figure>
  );
}
