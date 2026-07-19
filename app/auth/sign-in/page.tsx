import Link from "next/link";

import { ProductLogo } from "@/components/product-logo";

import { SignInForm } from "./sign-in-form";

const PANEL_LINES = [
  { tag: "Layer 01", text: "Recording captured · 42 min" },
  { tag: "Layer 02", text: "Transcript ready · 6 speakers" },
  { tag: "Layer 03", text: "Summary structured · 4 decisions" },
  { tag: "Layer 04", text: "3 follow-ups routed to owners" },
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;
  const signInCallbackUrl = Array.isArray(callbackUrl)
    ? callbackUrl[0]
    : callbackUrl;

  return (
    <main className="grid min-h-screen bg-ivory font-landing text-ink antialiased lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden border-r-2 border-ink bg-ink text-ivory lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:56px_56px]"
        />
        <div className="relative">
          <ProductLogo className="invert" />
        </div>
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ivory/50">
            Meeting intelligence
          </p>
          <h2 className="font-display mt-5 max-w-[15ch] text-5xl leading-[1.0] tracking-tight">
            Every meeting, unrolled into{" "}
            <em className="font-light italic text-cobalt">insight</em>.
          </h2>
          <ul className="mt-12 flex flex-col gap-3">
            {PANEL_LINES.map((line, i) => (
              <li
                key={line.tag}
                className="flex items-center gap-4 border-2 border-ivory/15 bg-ivory/5 px-5 py-4"
                style={{ marginLeft: `${i * 1.25}rem` }}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-cobalt">
                  {line.tag}
                </span>
                <span className="text-sm text-ivory/80">{line.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-mono text-[10px] uppercase tracking-[0.25em] text-ivory/40">
          Trusted by IOSG · Bcap · Maelstrom
        </p>
      </section>

      {/* Sign-in panel */}
      <section className="relative flex flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] [background-size:56px_56px]"
        />
        <header className="relative flex items-center justify-between px-6 py-5 sm:px-10 lg:justify-end">
          <Link
            href="/"
            aria-label="Tape home"
            className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-4 lg:hidden"
          >
            <ProductLogo />
          </Link>
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60 transition-colors hover:text-ink"
          >
            ← Back to site
          </Link>
        </header>
        <div className="relative flex flex-1 items-center justify-center px-6 pb-16 sm:px-10">
          <div className="w-full max-w-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cobalt">
              Workspace access
            </p>
            <h1 className="font-display mt-4 text-4xl leading-tight tracking-tight sm:text-5xl">
              Sign in to Tape.
            </h1>
            <p className="mt-5 text-base leading-7 text-ink/70">
              Use your company Google account to open your team&apos;s meeting
              workspace — transcripts, summaries, and follow-ups included.
            </p>
            <div className="mt-10">
              <SignInForm callbackUrl={signInCallbackUrl} />
            </div>
            <div className="mt-12 grid gap-4 border-t-2 border-dashed border-ink/20 pt-8 text-sm leading-6 text-ink/60">
              <p>
                <span className="font-semibold text-ink">Members</span> review
                and add meetings across the workspace.
              </p>
              <p>
                <span className="font-semibold text-ink">External readers</span>{" "}
                only see transcripts explicitly shared with them.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
