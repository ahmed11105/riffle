"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MagicLinkForm } from "@/components/MagicLinkForm";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function SignInPage() {
  const { isAnonymous, loading } = useAuth();
  const router = useRouter();

  // Already signed in? Send them to their dashboard.
  useEffect(() => {
    if (loading) return;
    if (!isAnonymous) router.replace("/account");
  }, [loading, isAnonymous, router]);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10 text-amber-100">
      <section className="mt-12 flex w-full max-w-md flex-col items-center text-center">
        <h1 className="text-4xl font-black tracking-tight text-amber-100">
          Sign in to Riffle
        </h1>
        <p className="mt-3 text-sm text-amber-100/70">
          We&rsquo;ll email you a one-tap magic link. No password to remember.
        </p>

        <div className="mt-6 w-full rounded-3xl border-4 border-stone-900 bg-stone-50 p-5 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
          <MagicLinkForm />
        </div>

        <p className="mt-6 text-xs text-amber-100/50">
          New to Riffle? You&rsquo;re already playing as a guest — signing in
          just keeps your streak across devices.
        </p>
      </section>
    </main>
  );
}
