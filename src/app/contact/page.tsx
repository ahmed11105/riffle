import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/branding/Logo";
import { MainNav } from "@/components/MainNav";
import { ContactClient } from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Riffle team about bugs, account questions, payments, or feedback.",
};

export default function ContactPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10 text-amber-100">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <MainNav />
      </header>

      <article className="mt-10 w-full max-w-3xl rounded-3xl border-4 border-stone-900 bg-stone-50 p-8 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <h1 className="text-4xl font-black">Get in touch</h1>
        <p className="mt-2 text-stone-600">
          Riffle is a small operation. Email is the fastest way to reach us. We
          read everything and reply within a few working days.
        </p>

        <ContactClient />

        <h2 className="mt-10 text-2xl font-black">What to send</h2>
        <ul className="mt-3 ml-6 list-disc space-y-2 text-stone-700">
          <li>
            <strong>Bug reports:</strong> tell us what you tried, what you
            expected, and what happened. Browser + device helps too.
          </li>
          <li>
            <strong>Account or Riffs questions:</strong> include the email on
            your account if you have one. Don&rsquo;t send your password.
          </li>
          <li>
            <strong>Pack or song requests:</strong> we love these. Drop the
            artist or theme you want to see.
          </li>
          <li>
            <strong>Privacy or data requests:</strong> we&rsquo;ll respond
            within 30 days as set out in our{" "}
            <Link href="/privacy" className="font-bold text-amber-700 underline">
              Privacy Policy
            </Link>
            .
          </li>
          <li>
            <strong>Legal or rights-holder takedown:</strong> see our{" "}
            <Link href="/terms" className="font-bold text-amber-700 underline">
              Terms
            </Link>
            .
          </li>
        </ul>

        <p className="mt-8 text-sm text-stone-500">
          We don&rsquo;t take real-money disputes over wagers, points, or
          streaks, those have no monetary value. For payment issues with Riffs
          purchases, include your Stripe receipt number.
        </p>
      </article>
    </main>
  );
}
