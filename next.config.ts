import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

// Sentry's webpack plugin uploads source maps and tunnels error-tracking
// requests to dodge ad-blockers. It's a no-op locally without auth tokens.
const sentryWebpackPluginOptions = {
  silent: true,
  org: "riffle",
  project: "riffle-web",
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
