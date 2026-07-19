"use client";

import { motion } from "framer-motion";

const CUSTOMERS = [
  { name: "IOSG Ventures", tag: "Crypto VC" },
  { name: "Bcap", tag: "Blockchain Capital" },
  { name: "Maelstrom", tag: "Investment Firm" },
];

const STATS = [
  { value: "40 min", label: "saved per meeting reviewed" },
  { value: "3×", label: "faster follow-up on decisions" },
  { value: "100%", label: "of calls searchable by day one" },
];

export function LandingCustomers() {
  return (
    <section id="customers" className="border-b-2 border-ink bg-ink text-ivory">
      <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="font-mono text-[11px] uppercase tracking-[0.3em] text-ivory/50"
        >
          Trusted by teams who live in meetings
        </motion.p>
        <div className="mt-10 grid gap-px bg-ivory/15 sm:grid-cols-3">
          {CUSTOMERS.map((customer, i) => (
            <motion.div
              key={customer.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="flex flex-col justify-between gap-10 bg-ink p-8"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory/40">
                {customer.tag}
              </span>
              <span className="font-display text-3xl tracking-tight sm:text-4xl">
                {customer.name}
              </span>
            </motion.div>
          ))}
        </div>
        <div className="mt-16 grid gap-10 sm:grid-cols-3">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.08 }}
              className="border-l-2 border-cobalt pl-5"
            >
              <div className="font-display text-4xl text-cobalt sm:text-5xl">
                {stat.value}
              </div>
              <p className="mt-2 max-w-[24ch] text-sm leading-6 text-ivory/60">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
