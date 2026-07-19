"use client";

import { motion } from "framer-motion";

const PARTNERS = [
  { name: "Vercel", kind: "Hosting" },
  { name: "Neon", kind: "Database" },
  { name: "AWS", kind: "Storage & Compute" },
  { name: "Inngest", kind: "Workflows" },
  { name: "ElevenLabs", kind: "Voice AI" },
  { name: "OneSignal", kind: "Notifications" },
  { name: "Recall.ai", kind: "Meeting Capture" },
  { name: "Anthropic", kind: "Models" },
];

export function LandingPartners() {
  return (
    <section id="partners" className="border-b-2 border-ink">
      <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap items-end justify-between gap-6"
        >
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cobalt">
              Built on
            </p>
            <h2 className="font-display mt-4 text-3xl tracking-tight text-ink sm:text-4xl">
              Infrastructure your team already trusts.
            </h2>
          </div>
          <p className="max-w-[36ch] text-sm leading-6 text-ink/60">
            Tape runs on proven SaaS and cloud infrastructure — no snowflake
            stack for your IT team to babysit.
          </p>
        </motion.div>
        <div className="mt-10 grid grid-cols-2 gap-px border-2 border-ink bg-ink/15 sm:grid-cols-4">
          {PARTNERS.map((partner, i) => (
            <motion.div
              key={partner.name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group flex h-28 flex-col items-center justify-center gap-2 bg-ivory transition-colors hover:bg-ivory-deep"
            >
              <span className="font-display text-xl tracking-tight text-ink transition-colors group-hover:text-cobalt sm:text-2xl">
                {partner.name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/45">
                {partner.kind}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
