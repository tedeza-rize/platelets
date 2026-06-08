export type Locale = "ko" | "en";

export type MapDictionary = {
  activeProvider: string;
  ariaLabel: string;
  missingKeyBody: string;
  missingKeyTitle: string;
  providerLegend: string;
  providers: {
    osm: string;
    vworld: string;
  };
  title: string;
};

type Dictionary = {
  map: MapDictionary;
  metadata: {
    description: string;
    title: string;
  };
  navigation: {
    brand: string;
    defaultProvider: string;
    label: string;
  };
};

const dictionaries: Record<Locale, Dictionary> = {
  ko: {
    map: {
      activeProvider: "선택한 지도: {provider}",
      ariaLabel: "서울 중심의 인터랙티브 지도",
      missingKeyBody:
        ".env.local에 NEXT_PUBLIC_VWORLD_API_KEY를 설정하면 브이월드 타일이 표시됩니다. 지금은 OSM 타일로 지도를 유지합니다.",
      missingKeyTitle: "브이월드 API 키가 필요합니다",
      providerLegend: "지도 제공자",
      providers: {
        osm: "OSM",
        vworld: "브이월드",
      },
      title: "지도",
    },
    metadata: {
      description: "브이월드와 OSM을 선택할 수 있는 반응형 지도 화면",
      title: "Platelets 지도",
    },
    navigation: {
      brand: "Platelets",
      defaultProvider: "기본 지도: 브이월드",
      label: "주요 탐색",
    },
  },
  en: {
    map: {
      activeProvider: "Selected map: {provider}",
      ariaLabel: "Interactive map centered on Seoul",
      missingKeyBody:
        "Set NEXT_PUBLIC_VWORLD_API_KEY in .env.local to show VWorld tiles. The map stays available with OSM tiles for now.",
      missingKeyTitle: "VWorld API key required",
      providerLegend: "Map provider",
      providers: {
        osm: "OSM",
        vworld: "VWorld",
      },
      title: "Map",
    },
    metadata: {
      description:
        "Responsive map view with selectable VWorld and OSM providers",
      title: "Platelets Map",
    },
    navigation: {
      brand: "Platelets",
      defaultProvider: "Default map: VWorld",
      label: "Primary navigation",
    },
  },
};

export function resolveLocale(acceptLanguage: string | null): Locale {
  if (acceptLanguage?.toLowerCase().startsWith("ko")) {
    return "ko";
  }

  return "en";
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
