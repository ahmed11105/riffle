// Analytics consent (UK/EU GDPR + ePrivacy). PostHog is gated on this;
// Sentry runs as a strictly-necessary service-monitoring tool.

export type ConsentStatus = "granted" | "denied";

const KEY = "riffle_analytics_consent";
const EVENT = "riffle:consent-changed";

export function getConsent(): ConsentStatus | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "granted" || v === "denied" ? v : null;
}

export function setConsent(status: ConsentStatus): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, status);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: status }));
}

export function onConsentChange(cb: (status: ConsentStatus) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ConsentStatus>).detail;
    cb(detail);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
