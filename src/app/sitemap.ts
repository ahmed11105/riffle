import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://riffle.cc";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/daily`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/solo`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/rooms`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/leaderboard`, lastModified, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/shop`, lastModified, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/contact`, lastModified, changeFrequency: "monthly", priority: 0.3 },
  ];
}
