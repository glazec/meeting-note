"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

import { HeroStack } from "./hero-stack";
import { LAYERS } from "./layers-data";
import { ProductLogo } from "@/components/product-logo";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export function LandingHero() {
  const [activeId, setActiveId] = useState<string>("insight");
  const active = LAYERS.find((l) => l.id === activeId) ?? LAYERS[0];

  return (
    <section className="relative overflow-hidden border-b-2 border-ink">
      {/* faint engineering grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] [background-size:56px_56px]"
      />
      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:pb-24 lg:pt-36">
        <div className="flex flex-col justify-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="font-mono text-[11px] uppercase tracking-[0.3em] text-cobalt"
          >
            Meeting intelligence for teams
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
            className="font-display mt-6 max-w-[14ch] text-5xl leading-[0.98] tracking-tight text-ink sm:text-7xl lg:text-[5.4rem]"
          >
            Every meeting, unrolled into{" "}
            <em className="font-light italic text-cobalt">insight</em>.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.16, ease: EASE }}
            className="mt-7 max-w-[46ch] text-lg leading-8 text-ink/70"
          >
            Tape records, transcribes, and peels every call into layers —
            recording, transcript, summary, and the decisions your team
            actually needs. No rewatching. No lost follow-ups.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24, ease: EASE }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              href="/auth/sign-in"
              className="group inline-flex h-12 items-center gap-3 border-2 border-ink bg-cobalt px-7 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ivory shadow-[6px_6px_0_0_var(--ink)] transition-transform duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_var(--ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_var(--ink)]"
            >
              Start free
              <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center border-2 border-ink bg-transparent px-7 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-ink hover:text-ivory"
            >
              See the layers
            </a>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="mt-14 hidden items-end gap-10 lg:flex"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
              Active layer
              <div className="mt-2 flex gap-1.5" role="tablist" aria-label="Layers">
                {LAYERS.map((layer) => (
                  <button
                    key={layer.id}
                    role="tab"
                    aria-selected={layer.id === activeId}
                    onClick={() => setActiveId(layer.id)}
                    className={cn(
                      "h-1.5 w-10 transition-colors",
                      layer.id === activeId ? "bg-cobalt" : "bg-ink/15 hover:bg-ink/30",
                    )}
                    aria-label={layer.tag}
                  />
                ))}
              </div>
            </div>
            <p className="max-w-[30ch] border-l-2 border-cobalt pl-4 text-sm leading-6 text-ink/70">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
                {active.tag}
                <br />
              </span>
              {active.body}
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: EASE }}
          className="relative h-[440px] sm:h-[520px] lg:h-[560px]"
        >
          <div className="absolute inset-0 hidden items-center justify-center lg:flex">
            <ProductLogo className="sr-only" />
          </div>
          <HeroStack activeId={activeId} onActivate={setActiveId} />
          <p className="absolute bottom-2 left-1/2 w-full -translate-x-1/2 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-ink/40">
            Click a layer · move to tilt
          </p>
        </motion.div>
      </div>
    </section>
  );
}
