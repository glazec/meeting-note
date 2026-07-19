"use client";

import { motion } from "framer-motion";

import { LAYERS } from "./layers-data";

const EASE = [0.16, 1, 0.3, 1] as const;

export function LandingLayers() {
  return (
    <section id="how-it-works" className="border-b-2 border-ink">
      <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className="font-mono text-[11px] uppercase tracking-[0.3em] text-cobalt"
            >
              How it works
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
              className="font-display mt-5 max-w-[16ch] text-4xl leading-[1.02] tracking-tight text-ink sm:text-5xl"
            >
              One call. Four layers. Zero rewatching.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.16, ease: EASE }}
              className="mt-6 max-w-[42ch] text-base leading-7 text-ink/70"
            >
              Tape unrolls every meeting the same way — so your team always
              knows where to look. Raw recording at the bottom, action at the
              top.
            </motion.p>
          </div>
          <ol className="relative flex flex-col gap-6">
            {LAYERS.map((layer, i) => (
              <motion.li
                key={layer.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
                className="group relative border-2 border-ink bg-ivory p-7 shadow-[6px_6px_0_0_var(--ink)] transition-transform duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_var(--ink)] sm:p-9"
                style={{ marginLeft: `${i * 1.5}rem` }}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
                    {layer.tag}
                  </span>
                  <span className="font-display text-5xl leading-none text-ink/10 transition-colors group-hover:text-cobalt/30 sm:text-6xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-display mt-4 text-2xl tracking-tight text-ink sm:text-3xl">
                  {layer.title}
                </h3>
                <p className="mt-3 max-w-[52ch] text-sm leading-6 text-ink/70">
                  {layer.body}
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {layer.chips.map((chip) => (
                    <span
                      key={chip}
                      className="border border-ink/25 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink/60"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
