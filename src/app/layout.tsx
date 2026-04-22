import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AdminKeyListener } from "@/components/AdminKeyListener";
import { AdminFrame } from "@/components/AdminFrame";
import { GlobalAudioBar } from "@/components/GlobalAudioBar";
import { Footer } from "@/components/Footer";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { AnalyticsProvider } from "@/lib/analytics/AnalyticsProvider";
import { Onboarding } from "@/components/Onboarding";
import { MobileNav } from "@/components/MobileNav";
import { ConsentBanner } from "@/components/ConsentBanner";
import { AccountButton } from "@/components/AccountButton";
import { ReferralRedeemer } from "@/components/ReferralRedeemer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://riffle.cc";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Riffle, Daily song-guessing game",
    template: "%s · Riffle",
  },
  description:
    "Name the tune from one second of audio. Daily streaks, friends rooms, and points-based wagers. Play free.",
  applicationName: "Riffle",
  keywords: ["song quiz", "music game", "daily game", "heardle", "guess the song"],
  openGraph: {
    title: "Riffle, Daily song-guessing game",
    description:
      "Name the tune from one second of audio. Daily streaks, friends rooms, and points-based wagers.",
    type: "website",
    siteName: "Riffle",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Riffle, Daily song-guessing game",
    description:
      "Name the tune from one second of audio. Daily streaks, friends rooms, and points-based wagers.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a140c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // viewport-fit=cover lets the body extend into the notch/home-indicator
  // area. Combined with safe-area-inset padding in globals.css, this
  // keeps the dark background edge-to-edge on iPhones.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AnalyticsProvider>
            <Suspense>
              <AdminKeyListener />
              <AdminFrame />
            </Suspense>
            <Suspense>
              <MobileNav />
            </Suspense>
            <Suspense>
              <AccountButton variant="floating" />
            </Suspense>
            {children}
            <Footer />
            <Suspense>
              <GlobalAudioBar />
            </Suspense>
            <Onboarding />
            <ConsentBanner />
            <Suspense>
              <ReferralRedeemer />
            </Suspense>
          </AnalyticsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
