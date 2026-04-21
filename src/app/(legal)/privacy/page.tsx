import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Riffle collects, uses, and protects your data.",
};

const LAST_UPDATED = "18 April 2026";

export default function PrivacyPage() {
  return (
    <div className="prose prose-stone max-w-none">
      <h1 className="text-4xl font-black">Privacy Policy</h1>
      <p className="text-sm text-stone-500">Last updated: {LAST_UPDATED}</p>

      <h2 className="mt-8 text-2xl font-black">Who we are</h2>
      <p>
        Riffle (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the website at{" "}
        <strong>riffle.cc</strong> and the daily song-guessing game accessible
        through it. For privacy questions, contact us at{" "}
        <a href="mailto:rifflehq@gmail.com" className="font-bold text-amber-700 underline">
          rifflehq@gmail.com
        </a>
        .
      </p>

      <h2 className="mt-8 text-2xl font-black">Information we collect</h2>
      <ul className="ml-6 list-disc space-y-2">
        <li>
          <strong>Account data</strong> (only if you sign up): your email
          address, optional display name, and a unique account identifier.
        </li>
        <li>
          <strong>Anonymous play data:</strong> if you play without an account,
          we generate a temporary anonymous user identifier so we can save your
          progress, streak, and Riffs balance to your device session.
        </li>
        <li>
          <strong>Gameplay data:</strong> daily puzzle results, streaks,
          friends-room participation, wager outcomes, hint use, pack purchases.
        </li>
        <li>
          <strong>Usage analytics:</strong> page views, feature interactions,
          and error reports, used in aggregate to improve the product. We do
          not sell this data.
        </li>
        <li>
          <strong>Device data:</strong> browser type, screen size, IP address
          (for rate limiting and abuse prevention only, not stored
          long-term).
        </li>
      </ul>

      <h2 className="mt-8 text-2xl font-black">How we use it</h2>
      <ul className="ml-6 list-disc space-y-2">
        <li>To provide the game (saving progress, syncing rooms, awarding Riffs).</li>
        <li>To prevent abuse and enforce rate limits.</li>
        <li>To measure feature adoption and improve gameplay (aggregated analytics).</li>
        <li>To process Riffs purchases (via Stripe, see &ldquo;Third parties&rdquo; below).</li>
      </ul>

      <h2 className="mt-8 text-2xl font-black">Third parties</h2>
      <p>We share data only with the providers needed to run the service:</p>
      <ul className="ml-6 list-disc space-y-2">
        <li>
          <strong>Supabase</strong> (database, auth, realtime), stores your
          account, gameplay data, and Riffs balance.
        </li>
        <li>
          <strong>Vercel</strong> (hosting), serves the website and processes
          requests.
        </li>
        <li>
          <strong>Stripe</strong> (payments), processes Riffs purchases. We
          never see or store your card details.
        </li>
        <li>
          <strong>Apple iTunes</strong>, we link to public song preview clips.
          Apple may log these requests independently.
        </li>
        <li>
          <strong>PostHog</strong> (analytics) and <strong>Sentry</strong>{" "}
          (error reporting), usage and crash data, anonymised where possible.
        </li>
      </ul>

      <h2 className="mt-8 text-2xl font-black">Cookies and local storage</h2>
      <p>
        We use cookies for authentication sessions and to remember your
        preferences. We use browser local storage to save your daily progress,
        played-songs history, and onboarding state. You can clear these at any
        time from your browser settings.
      </p>

      <h2 className="mt-8 text-2xl font-black">Your rights</h2>
      <p>
        Depending on your jurisdiction (e.g. UK GDPR, EU GDPR, CCPA), you have
        the right to access, correct, export, or delete your personal data. To
        exercise any of these rights, email{" "}
        <a href="mailto:rifflehq@gmail.com" className="font-bold text-amber-700 underline">
          rifflehq@gmail.com
        </a>{" "}
        and we&rsquo;ll respond within 30 days.
      </p>

      <h2 className="mt-8 text-2xl font-black">Children</h2>
      <p>
        Riffle is not directed at children under 13 (or under 16 in the EU/UK).
        If you believe a child has created an account, contact us and
        we&rsquo;ll delete it.
      </p>

      <h2 className="mt-8 text-2xl font-black">Changes</h2>
      <p>
        We&rsquo;ll update this policy as the product evolves. The
        &ldquo;Last updated&rdquo; date at the top will reflect any change.
        Material changes will be announced in-app.
      </p>
    </div>
  );
}
