import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LandingCta } from "@/components/landing/landing-cta";
import { LandingCustomers } from "@/components/landing/landing-customers";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingInsights } from "@/components/landing/landing-insights";
import { LandingLayers } from "@/components/landing/landing-layers";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingPartners } from "@/components/landing/landing-partners";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tape — Meeting intelligence for teams",
  description:
    "Tape records, transcribes, and peels every meeting into layers — recording, transcript, summary, and the decisions your team actually needs.",
};

export default async function LandingPage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-ivory font-landing text-ink antialiased">
      <LandingNav />
      <LandingHero />
      <LandingCustomers />
      <LandingLayers />
      <LandingInsights />
      <LandingPartners />
      <LandingCta />
    </main>
  );
}
