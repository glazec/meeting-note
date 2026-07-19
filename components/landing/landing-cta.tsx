"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { ProductLogo } from "@/components/product-logo";

const EASE = [0.16, 1, 0.3, 1] as const;

const TRUST_ITEMS = [
  {
    title: "Workspace-scoped access",
    body: "Members see their team's meetings. External readers only see what is explicitly shared.",
  },
  {
    title: "Your models, your data",
    body: "Transcripts stay in your workspace. Nothing trains public models.",
  },
  {
    title: "SSO with Google",
    body: "One-click sign-in with your company account. No passwords to leak.",
  },
];

export function LandingCta() {
  return (
    <>
      <section className="border-b-2 border-ink">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-3 lg:py-24">
          {TRUST_ITEMS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
              className="border-l-2 border-ink pl-5"
            >
              <h3 className="font-display text-xl tracking-tight text-ink">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-ink/65">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>
      <section className="relative overflow-hidden bg-cobalt text-ivory">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:56px_56px]"
        />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-start gap-10 px-5 py-24 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-32">
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: EASE }}
            className="font-display max-w-[16ch] text-5xl leading-[0.98] tracking-tight sm:text-7xl"
          >
            Your next meeting is the last one you rewatch.
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, delay: 0.12, ease: EASE }}
            className="flex flex-col items-start gap-4"
          >
            <Link
              href="/auth/sign-in"
              className="group inline-flex h-14 items-center gap-3 border-2 border-ivory bg-ivory px-8 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ink shadow-[6px_6px_0_0_rgba(0,0,0,0.35)] transition-transform duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
            >
              Get started free
              <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ivory/70">
              Free for teams up to 10 · No credit card
            </p>
          </motion.div>
        </div>
      </section>
      <footer className="bg-ink text-ivory">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <ProductLogo className="invert" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory/50">
              Meeting intelligence
            </span>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ivory/60"
          >
            <a href="#how-it-works" className="transition-colors hover:text-ivory">
              Layers
            </a>
            <a href="#insights" className="transition-colors hover:text-ivory">
              Insights
            </a>
            <a href="#customers" className="transition-colors hover:text-ivory">
              Customers
            </a>
            <Link
              href="/auth/sign-in"
              className="transition-colors hover:text-ivory"
            >
              Sign in
            </Link>
          </nav>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory/40">
            © 2026 Tape
          </p>
        </div>
      </footer>
    </>
  );
}
