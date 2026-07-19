"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

const QUESTIONS = [
  {
    id: "decided",
    label: "What did we decide?",
    answer:
      "Ship the new onboarding flow on Thursday. Pricing page copy stays as-is until the experiment closes.",
    citations: ["00:12:41", "00:31:07"],
  },
  {
    id: "owners",
    label: "Who owns what?",
    answer:
      "Priya owns the launch checklist, Marco owns the changelog draft, and Aiko confirms the customer webinar date.",
    citations: ["00:34:52"],
  },
  {
    id: "risks",
    label: "What went unsaid?",
    answer:
      "Two participants flagged timeline risk indirectly — \"if QA cooperates\" and \"best case Friday\". Worth a follow-up before Thursday.",
    citations: ["00:18:20", "00:26:44"],
  },
  {
    id: "followups",
    label: "What needs follow-up?",
    answer:
      "Three open items: legal review of the terms page, analytics dashboard access for the CS team, and a decision on the annual-plan discount.",
    citations: ["00:41:15"],
  },
] as const;

const TRANSCRIPT_LINE =
  "…so if QA cooperates we can probably ship Thursday, best case Friday — Priya can you take the checklist? And someone still needs to chase legal on the terms page…";

export function LandingInsights() {
  const [openId, setOpenId] = useState<string>("decided");
  const open = QUESTIONS.find((q) => q.id === openId) ?? QUESTIONS[0];

  return (
    <section id="insights" className="border-b-2 border-ink bg-ivory-deep">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="font-mono text-[11px] uppercase tracking-[0.3em] text-cobalt"
          >
            Ask the meeting
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
            className="font-display mt-5 max-w-[16ch] text-4xl leading-[1.02] tracking-tight text-ink sm:text-5xl"
          >
            Stop scrubbing timelines. Start asking questions.
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.16, ease: EASE }}
            className="mt-8 border-2 border-ink bg-ivory p-6 shadow-[6px_6px_0_0_var(--ink)]"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
              Transcript · 00:18:20
            </p>
            <p className="mt-3 text-sm leading-7 text-ink/80">
              {TRANSCRIPT_LINE.split("if QA cooperates").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 ? (
                    <mark className="bg-cobalt/15 px-1 text-cobalt">
                      if QA cooperates
                    </mark>
                  ) : null}
                </span>
              ))}
            </p>
          </motion.div>
        </div>
        <div className="flex flex-col justify-center gap-3" role="tablist" aria-label="Insight questions">
          {QUESTIONS.map((question, i) => {
            const isOpen = question.id === openId;
            return (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.07, ease: EASE }}
                className={cn(
                  "border-2 transition-colors",
                  isOpen
                    ? "border-ink bg-ivory shadow-[6px_6px_0_0_var(--ink)]"
                    : "border-ink/30 bg-transparent hover:border-ink/60",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isOpen}
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(question.id)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span
                    className={cn(
                      "font-display text-xl tracking-tight sm:text-2xl",
                      isOpen ? "text-ink" : "text-ink/60",
                    )}
                  >
                    {question.label}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "font-mono text-lg transition-transform duration-200",
                      isOpen ? "rotate-45 text-cobalt" : "text-ink/40",
                    )}
                  >
                    +
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="border-t-2 border-dashed border-ink/20 px-6 pb-6 pt-4">
                        <p className="text-sm leading-7 text-ink/80">
                          {open.answer}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {open.citations.map((citation) => (
                            <span
                              key={citation}
                              className="border border-cobalt/40 px-2 py-0.5 font-mono text-[10px] tracking-widest text-cobalt"
                            >
                              {citation}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
