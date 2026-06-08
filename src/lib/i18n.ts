export type Locale = "ko" | "en";

export type MapDictionary = {
  activeProvider: string;
  ariaLabel: string;
  datasets: {
    all: string;
    fire: string;
    lastUpdated: string;
    loading: string;
    neverUpdated: string;
    panelLabel: string;
    points: string;
    police: string;
    refreshAll: string;
    refreshFire: string;
    refreshPolice: string;
    showFire: string;
    showPolice: string;
    updateFailed: string;
    updating: string;
  };
  missingKeyBody: string;
  missingKeyTitle: string;
  providerButtonLabel: string;
  providerLegend: string;
  providerMenuLabel: string;
  providers: {
    osm: string;
    vworld: string;
  };
  popup: {
    address: string;
    kakaoMap: string;
    naverMap: string;
    phone: string;
    sourceUpdatedAt: string;
  };
  title: string;
};

export type AppDictionary = {
  map: MapDictionary;
  metadata: {
    description: string;
    title: string;
  };
  navigation: {
    brand: string;
    defaultProvider: string;
    homeLabel: string;
    label: string;
    title: string;
  };
};

const dictionaries: Record<Locale, AppDictionary> = {
  ko: {
    map: {
      activeProvider: "선택한 지도: {provider}",
      ariaLabel: "전국 비상 대응 거점 지도",
      datasets: {
        all: "전체",
        fire: "소방",
        lastUpdated: "갱신",
        loading: "불러오는 중",
        neverUpdated: "미갱신",
        panelLabel: "표시 항목",
        points: "표시 지점",
        police: "경찰",
        refreshAll: "전체 업데이트",
        refreshFire: "소방 업데이트",
        refreshPolice: "경찰 업데이트",
        showFire: "소방 표시",
        showPolice: "경찰 표시",
        updateFailed: "업데이트 실패",
        updating: "업데이트 중",
      },
      missingKeyBody:
        ".env.local에 NEXT_PUBLIC_VWORLD_API_KEY를 설정하면 브이월드 타일이 표시됩니다. 지금은 OSM 타일로 지도를 유지합니다.",
      missingKeyTitle: "브이월드 API 키가 필요합니다",
      providerButtonLabel: "{provider} 지도로 전환",
      providerLegend: "지도 제공자",
      providerMenuLabel: "지도 서비스 선택: 현재 {provider}",
      providers: {
        osm: "OSM",
        vworld: "브이월드",
      },
      popup: {
        address: "주소",
        kakaoMap: "카카오맵",
        naverMap: "네이버 지도",
        phone: "전화",
        sourceUpdatedAt: "자료 기준일",
      },
      title: "지도",
    },
    metadata: {
      description:
        "브이월드와 OSM을 선택할 수 있는 전국 비상 대응 거점 지도 화면",
      title: "Platelets 지도",
    },
    navigation: {
      brand: "Platelets",
      defaultProvider: "기본 지도: 브이월드",
      homeLabel: "홈",
      label: "주요 탐색",
      title: "실시간 비상 현황 확인 시스템 / PLATELETS",
    },
  },
  en: {
    map: {
      activeProvider: "Selected map: {provider}",
      ariaLabel: "Nationwide emergency response point map",
      datasets: {
        all: "All",
        fire: "Fire",
        lastUpdated: "Updated",
        loading: "Loading",
        neverUpdated: "Not updated",
        panelLabel: "Visible categories",
        points: "Visible points",
        police: "Police",
        refreshAll: "Update all",
        refreshFire: "Update fire",
        refreshPolice: "Update police",
        showFire: "Show fire",
        showPolice: "Show police",
        updateFailed: "Update failed",
        updating: "Updating",
      },
      missingKeyBody:
        "Set NEXT_PUBLIC_VWORLD_API_KEY in .env.local to show VWorld tiles. The map stays available with OSM tiles for now.",
      missingKeyTitle: "VWorld API key required",
      providerButtonLabel: "Switch to {provider} map",
      providerLegend: "Map provider",
      providerMenuLabel: "Choose map service: currently {provider}",
      providers: {
        osm: "OSM",
        vworld: "VWorld",
      },
      popup: {
        address: "Address",
        kakaoMap: "Kakao Map",
        naverMap: "Naver Map",
        phone: "Phone",
        sourceUpdatedAt: "Source date",
      },
      title: "Map",
    },
    metadata: {
      description:
        "Responsive emergency point map view with selectable VWorld and OSM providers",
      title: "Platelets Map",
    },
    navigation: {
      brand: "Platelets",
      defaultProvider: "Default map: VWorld",
      homeLabel: "Home",
      label: "Primary navigation",
      title: "Emergency Status Monitoring System / PLATELETS",
    },
  },
};

export function resolveLocale(acceptLanguage: string | null): Locale {
  if (acceptLanguage?.toLowerCase().startsWith("ko")) {
    return "ko";
  }

  return "en";
}

export function getDictionary(locale: Locale): AppDictionary {
  return dictionaries[locale];
}
