import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sera — Asisten Cerdas BCA Life",
    short_name: "Sera",
    description:
      "Senantiasa Melindungi Anda. Asisten cerdas BCA Life — selalu siap menemani langkahmu.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#061330",
    theme_color: "#061330",
    icons: [
      {
        src: "/sera-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sera-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sera-icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
