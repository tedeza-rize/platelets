import type { MetadataRoute } from "next";
import { getDictionary, uiText } from "@/lib/i18n";

export default function manifest(): MetadataRoute.Manifest {
  const dictionary = getDictionary("ko");

  return {
    background_color: "#f8fafc",
    description: uiText(dictionary, "pwa.manifest.description"),
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "any",
        src: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        purpose: "maskable",
        sizes: "any",
        src: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    name: uiText(dictionary, "pwa.manifest.name"),
    short_name: "Platelets",
    start_url: "/",
    theme_color: "#e11d48",
  };
}
