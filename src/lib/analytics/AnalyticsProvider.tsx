"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";
import posthog from "posthog-js";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { EventName } from "./events";
import { getConsent, onConsentChange } from "./consent";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let initialized = false;

function initPostHog() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (!POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    person_profiles: "identified_only",
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

type AnalyticsContextValue = {
  track: (event: EventName, props?: Record<string, unknown>) => void;
};

const AnalyticsContext = createContext<AnalyticsContextValue>({
  track: () => {},
});

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { user, isAnonymous } = useAuth();
  const [consentTick, setConsentTick] = useState(0);

  useEffect(() => {
    if (getConsent() === "granted") initPostHog();
    return onConsentChange((status) => {
      if (status === "granted") {
        initPostHog();
      } else if (initialized) {
        // User revoked: stop sending and forget the person.
        posthog.opt_out_capturing();
        posthog.reset();
      }
      setConsentTick((t) => t + 1);
    });
  }, []);

  // Identify the user once we know who they are. For anonymous users we
  // still set a distinct id so funnel data ties together, but we don't
  // create a persistent person profile until they upgrade their account.
  useEffect(() => {
    if (!initialized || !user) return;
    if (isAnonymous) {
      posthog.identify(user.id, { is_anonymous: true });
    } else {
      posthog.identify(user.id, {
        is_anonymous: false,
        email: user.email,
      });
    }
  }, [user, isAnonymous, consentTick]);

  const track = useCallback(
    (event: EventName, props?: Record<string, unknown>) => {
      if (!initialized) {
        // Surface dropped events in dev so we notice misconfig early.
        if (process.env.NODE_ENV !== "production") {
          console.debug("[analytics:skipped]", event, props);
        }
        return;
      }
      posthog.capture(event, props);
    },
    [],
  );

  return (
    <AnalyticsContext.Provider value={{ track }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}
