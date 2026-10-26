import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DistrictLocation } from '../components/DistrictLocation';
import { loadDemoDataset } from '../lib/data';
import type { DistrictMapProvider } from '../lib/google-district-map';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('DistrictLocation', () => {
  const districts = loadDemoDataset().districts;

  it('loads a real map with four districts and ten stores for the selected district', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'browser-key');
    vi.stubEnv('VITE_PUBLIC_LEGAL_URLS_READY', 'true');
    const destroy = vi.fn();
    const mapProvider: DistrictMapProvider = {
      renderMap: vi.fn().mockResolvedValue(destroy),
    };

    render(
      <DistrictLocation
        districts={districts}
        selectedDistrictId="fengjia"
        selectedStorePlaceId={undefined}
        onDistrictSelect={() => undefined}
        onStoreSelect={() => undefined}
        mapProvider={mapProvider}
      />,
    );

    expect(screen.getByRole('heading', { name: '臺中四商圈互動地圖' })).toBeInTheDocument();
    expect(screen.getByLabelText('臺中四商圈與代表店家互動地圖')).toBeInTheDocument();
    await waitFor(() => expect(mapProvider.renderMap).toHaveBeenCalledTimes(1));
    expect(mapProvider.renderMap).toHaveBeenCalledWith(expect.objectContaining({
      districts,
      selectedDistrictId: 'fengjia',
      selectedStorePlaceId: undefined,
      stores: expect.arrayContaining([
        expect.objectContaining({ name: '明倫蛋餅 逢甲福星店' }),
      ]),
    }));
    expect(mapProvider.renderMap.mock.calls[0][0].stores).toHaveLength(10);
  });

  it('connects map marker selections to district and store handlers', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'browser-key');
    vi.stubEnv('VITE_PUBLIC_LEGAL_URLS_READY', 'true');
    const onDistrictSelect = vi.fn();
    const onStoreSelect = vi.fn();
    const mapProvider: DistrictMapProvider = {
      renderMap: vi.fn().mockResolvedValue(() => undefined),
    };

    render(
      <DistrictLocation
        districts={districts}
        selectedDistrictId="fengjia"
        selectedStorePlaceId={undefined}
        onDistrictSelect={onDistrictSelect}
        onStoreSelect={onStoreSelect}
        mapProvider={mapProvider}
      />,
    );

    await waitFor(() => expect(mapProvider.renderMap).toHaveBeenCalled());
    const options = mapProvider.renderMap.mock.calls[0][0];
    options.onDistrictSelect('yizhong');
    options.onStoreSelect('store-place-id');

    expect(onDistrictSelect).toHaveBeenCalledWith('yizhong');
    expect(onStoreSelect).toHaveBeenCalledWith('store-place-id');
  });

  it('shows setup guidance instead of an empty map when browser credentials are absent', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('VITE_PUBLIC_LEGAL_URLS_READY', 'true');

    render(
      <DistrictLocation
        districts={districts}
        selectedDistrictId="fengjia"
        selectedStorePlaceId={undefined}
        onDistrictSelect={() => undefined}
        onStoreSelect={() => undefined}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('互動地圖尚未設定');
  });
});
