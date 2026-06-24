import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BIMA — BCA Life Intelligent Mobile Assistant",
    short_name: "BIMA",
    description:
      "Senantiasa Melindungi Anda. Asisten onboarding cerdas BCA Life — selalu siap menemani langkahmu.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#061330",
    theme_color: "#061330",
    icons: [
      {
        src: "/bima-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
