import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "is1-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is2-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is3-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is4-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is5-ssl.mzstatic.com" },
      { protocol: "https", hostname: "a1.mzstatic.com" },
      { protocol: "https", hostname: "a2.mzstatic.com" },
      { protocol: "https", hostname: "a3.mzstatic.com" },
      { protocol: "https", hostname: "a4.mzstatic.com" },
      { protocol: "https", hostname: "a5.mzstatic.com" },
    ],
  },
};

export default nextConfig;
