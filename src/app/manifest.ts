import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Riffle, Daily song-guessing game",
    short_name: "Riffle",
    description:
      "A daily song-guessing game with streaks, friends rooms, and points-based wagers. One second of a song is all you need.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a140c",
    theme_color: "#1a140c",
    categories: ["games", "music", "entertainment"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
