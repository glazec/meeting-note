"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { ProductLogo } from "@/components/product-logo";

export function LandingNav() {
  return (
    <motion.header
      initial={{ y: -64 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 border-b-2 border-ink bg-ivory/90 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          aria-label="Tape home"
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-4"
        >
          <ProductLogo />
        </Link>
        <nav
          aria-label="Site"
          className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/70 md:flex"
        >
          <a href="#how-it-works" className="transition-colors hover:text-ink">
            Layers
          </a>
          <a href="#insights" className="transition-colors hover:text-ink">
            Insights
          </a>
          <a href="#customers" className="transition-colors hover:text-ink">
            Customers
          </a>
          <a href="#partners" className="transition-colors hover:text-ink">
            Partners
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/sign-in"
            className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-ink/70 transition-colors hover:text-ink sm:inline"
          >
            Sign in
          </Link>
          <Link
            href="/auth/sign-in"
            className="inline-flex h-9 items-center border-2 border-ink bg-ink px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ivory transition-colors hover:bg-cobalt hover:border-cobalt"
          >
            Get started
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
