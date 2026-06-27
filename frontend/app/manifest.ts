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
        src: "/bima-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/bima-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/bima-icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
