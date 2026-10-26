export interface DistrictPhotoConfig {
  districtId: 'fengjia' | 'yizhong' | 'calligraphy' | 'gongyi';
  googlePlaceId?: string;
  alt: string;
  fallback: {
    src: string;
    author: string;
    filePageUrl: string;
    license: string;
    licenseUrl: string;
  };
}

export const districtPhotoById: Record<DistrictPhotoConfig['districtId'], DistrictPhotoConfig> = {
  fengjia: {
    districtId: 'fengjia',
    alt: '逢甲夜市夜間街景',
    fallback: {
      src: '/districts/fengjia.jpg',
      author: 'ironypoisoning',
      filePageUrl: 'https://commons.wikimedia.org/wiki/File:2015-05-28_Feng_Chia_Night_Market.jpg',
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
    },
  },
  yizhong: {
    districtId: 'yizhong',
    alt: '一中街商圈街景',
    fallback: {
      src: '/districts/yizhong.jpg',
      author: 'Telessy',
      filePageUrl: 'https://commons.wikimedia.org/wiki/File:Yizhong_Street,_North_District,_Taichung_City_20080101.jpg',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
  },
  calligraphy: {
    districtId: 'calligraphy',
    alt: '草悟道開放空間',
    fallback: {
      src: '/districts/calligraphy.jpg',
      author: 'Wpcpey',
      filePageUrl: 'https://commons.wikimedia.org/wiki/File:Calligraphy_Greenway_open_space_201905.jpg',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
  },
  gongyi: {
    districtId: 'gongyi',
    alt: '公益路街景',
    fallback: {
      src: '/districts/gongyi.jpg',
      author: 'Cheng-en Cheng',
      filePageUrl: 'https://commons.wikimedia.org/wiki/File:2020-09-17_Gongyi_Road,_Taichung.jpg',
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
    },
  },
};

export const districtPhotoConfigs = Object.values(districtPhotoById);

export function getDistrictPhotoConfig(districtId: string): DistrictPhotoConfig | undefined {
  return districtPhotoConfigs.find((photo) => photo.districtId === districtId);
}
