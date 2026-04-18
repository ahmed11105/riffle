import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The rules for playing Riffle and using the website.",
};

const LAST_UPDATED = "18 April 2026";

export default function TermsPage() {
  return (
    <div className="prose prose-stone max-w-none">
      <h1 className="text-4xl font-black">Terms of Use</h1>
      <p className="text-sm text-stone-500">Last updated: {LAST_UPDATED}</p>

      <p>
        By using Riffle, you agree to these terms. If you don&rsquo;t agree,
        please don&rsquo;t use the service.
      </p>

      <h2 className="mt-8 text-2xl font-black">1. The service</h2>
      <p>
        Riffle is an online game where players guess songs from short audio
        clips. It includes a daily puzzle, an unlimited solo mode, and
        multiplayer rooms with a wager mechanic. The service is provided
        &ldquo;as is&rdquo;, and we may add, change, or remove features at any
        time.
      </p>

      <h2 className="mt-8 text-2xl font-black">2. No real-money gambling</h2>
      <p>
        <strong>
          Riffle is a game of skill, not a gambling service.
        </strong>{" "}
        The &ldquo;wager&rdquo; mechanic uses in-game points only. Points and
        streaks have no monetary value, cannot be cashed out, exchanged for
        real money, or transferred between accounts. Riffs (our virtual
        currency) cannot be used to influence wager outcomes. Anyone offering
        to buy, sell, or trade Riffle accounts, points, or Riffs for real
        money is in violation of these terms.
      </p>

      <h2 className="mt-8 text-2xl font-black">3. Riffs (virtual currency)</h2>
      <ul className="ml-6 list-disc space-y-2">
        <li>
          Riffs are a virtual in-game currency. They have <strong>no cash
          value</strong>, are <strong>non-refundable</strong>, and{" "}
          <strong>non-transferable</strong>.
        </li>
        <li>
          Riffs can be earned through gameplay or purchased through Stripe.
          Purchased Riffs are credited to your account.
        </li>
        <li>
          Riffs can be spent on hints, themed packs, and cosmetics. Riffs{" "}
          <strong>cannot</strong> be used to place wagers or influence wager
          outcomes.
        </li>
        <li>
          We may revoke Riffs obtained through bugs, abuse, fraud, or
          chargebacks. We may also adjust prices, balances, or earn rates as
          the game evolves.
        </li>
        <li>
          If your account is closed (by you or by us for a violation),
          unspent Riffs are forfeited.
        </li>
      </ul>

      <h2 className="mt-8 text-2xl font-black">4. Your account</h2>
      <p>
        You can play anonymously or create an optional account. You&rsquo;re
        responsible for activity under your account. Don&rsquo;t share login
        credentials. Don&rsquo;t impersonate other people. Don&rsquo;t use
        automated tools, scripts, scrapers, or modified clients to play.
      </p>

      <h2 className="mt-8 text-2xl font-black">5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul className="ml-6 list-disc space-y-2">
        <li>Reverse-engineer, decompile, or attempt to extract source.</li>
        <li>Disrupt the service, servers, or other players (DoS, spam, harassment).</li>
        <li>Use offensive display names or chat content in friends rooms.</li>
        <li>Sell, trade, or buy accounts, Riffs, or in-game items for real money.</li>
        <li>Exploit bugs to gain points, Riffs, or pack access you didn&rsquo;t earn or buy.</li>
      </ul>
      <p>
        Violations may result in suspension or termination, with no refund of
        purchased Riffs.
      </p>

      <h2 className="mt-8 text-2xl font-black">6. Music and intellectual property</h2>
      <p>
        Song preview clips are streamed from the public Apple iTunes Search
        API. All song titles, artist names, and audio remain the property of
        their respective rights holders. Riffle does not host or own the
        music itself; we redirect playback requests to Apple&rsquo;s CDN. We
        comply with valid takedown requests from rights holders, see the
        DMCA section below.
      </p>

      <h2 className="mt-8 text-2xl font-black">6a. DMCA takedown notice</h2>
      <p>
        If you are a rights holder and believe content accessible through
        Riffle infringes your copyright, send a written notice to{" "}
        <a href="mailto:support@riffle.cc" className="font-bold text-amber-700 underline">
          support@riffle.cc
        </a>{" "}
        with the subject line &ldquo;DMCA Takedown&rdquo;. Per 17 U.S.C.
        &sect; 512(c)(3), the notice must include:
      </p>
      <ul className="ml-6 list-disc space-y-2">
        <li>Identification of the copyrighted work claimed to be infringed.</li>
        <li>
          Identification of the material on Riffle that is allegedly
          infringing, with enough detail for us to locate it (e.g. the song
          title, artist, and the page or feature where it appears).
        </li>
        <li>
          Your contact information: name, postal address, telephone number,
          and email address.
        </li>
        <li>
          A statement that you have a good-faith belief that the use is not
          authorised by the copyright owner, its agent, or the law.
        </li>
        <li>
          A statement, made under penalty of perjury, that the information in
          the notice is accurate and that you are the rights holder or
          authorised to act on the rights holder&rsquo;s behalf.
        </li>
        <li>Your physical or electronic signature.</li>
      </ul>
      <p>
        We will review valid notices promptly and remove or disable access to
        the identified content. Repeat infringers&rsquo; accounts will be
        terminated. Knowingly false notices may result in liability under
        17 U.S.C. &sect; 512(f).
      </p>
      <p>
        Counter-notices may be sent to the same address with the elements
        required by 17 U.S.C. &sect; 512(g)(3).
      </p>

      <h2 className="mt-8 text-2xl font-black">7. Disclaimers</h2>
      <p>
        The service is provided <strong>as is, without warranties</strong> of
        any kind. We don&rsquo;t guarantee uninterrupted access, accuracy of
        song metadata, or that your data will never be lost. Back up anything
        important.
      </p>

      <h2 className="mt-8 text-2xl font-black">8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Riffle&rsquo;s total liability
        to you for any claim arising from these terms or the service is
        limited to the greater of (a) the amount you have paid us in the
        previous 12 months, or (b) £50.
      </p>

      <h2 className="mt-8 text-2xl font-black">9. Termination</h2>
      <p>
        You can stop using Riffle at any time and request account deletion via{" "}
        <a href="mailto:support@riffle.cc" className="font-bold text-amber-700 underline">
          support@riffle.cc
        </a>
        . We can suspend or terminate your access for a violation of these
        terms.
      </p>

      <h2 className="mt-8 text-2xl font-black">10. Changes</h2>
      <p>
        We&rsquo;ll update these terms as the product evolves. The
        &ldquo;Last updated&rdquo; date at the top will reflect any change.
        Continued use after a change constitutes acceptance.
      </p>

      <h2 className="mt-8 text-2xl font-black">11. Governing law</h2>
      <p>
        These terms are governed by the laws of England and Wales. Any
        dispute will be resolved in the courts of England and Wales, unless
        applicable consumer law in your jurisdiction grants you the right to
        bring proceedings elsewhere.
      </p>

      <h2 className="mt-8 text-2xl font-black">12. Contact</h2>
      <p>
        For questions about these terms or any other Riffle-related matter,
        email{" "}
        <a href="mailto:legal@riffle.cc" className="font-bold text-amber-700 underline">
          legal@riffle.cc
        </a>{" "}
        or{" "}
        <a href="mailto:support@riffle.cc" className="font-bold text-amber-700 underline">
          support@riffle.cc
        </a>
        .
      </p>
    </div>
  );
}
