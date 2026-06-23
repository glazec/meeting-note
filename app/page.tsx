import Link from "next/link";

const transcriptRows = [
  {
    title: "Weekly product review",
    meta: "Google Meet, 42 min",
    status: "Ready",
    accent: "bg-emerald-500",
  },
  {
    title: "Pipeline sync",
    meta: "Zoom, recording",
    status: "Processing",
    accent: "bg-amber-500",
  },
  {
    title: "Customer call upload",
    meta: "MP3 upload, 28 min",
    status: "Ready",
    accent: "bg-sky-500",
  },
];

const metrics = [
  { label: "Internal members", value: "24" },
  { label: "Sources", value: "Meet, Zoom, MP3" },
  { label: "Storage", value: "Cloud" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-lg font-semibold">
            Meeting Transcript
          </Link>
          <Link
            href="/auth/sign-in"
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-16">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-[var(--primary)]">
            Team transcript workspace
          </p>
          <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-tight sm:text-6xl">
            Meeting Transcript
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Record Google Meet and Zoom calls, upload MP3 files, and keep every
            transcript available only to the right internal workspace members.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth/sign-in"
              className="inline-flex w-fit rounded-md bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white"
            >
              Sign in with Google
            </Link>
            <Link
              href="/auth/sign-in"
              className="inline-flex w-fit rounded-md border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface)]"
            >
              Open workspace
            </Link>
          </div>

          <dl className="mt-10 grid grid-cols-3 gap-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="border-t border-[var(--border)] pt-4">
                <dt className="text-sm text-[var(--muted)]">{metric.label}</dt>
                <dd className="mt-1 text-base font-semibold">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-sm font-semibold">Transcript queue</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Live recording, upload, and access status in one place.
            </p>
          </div>

          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
            <label htmlFor="home-search" className="text-sm font-medium">
              Search transcripts
            </label>
            <input
              id="home-search"
              type="search"
              placeholder="Search title, speaker, or transcript"
              className="mt-2 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div className="divide-y divide-[var(--border)]">
            {transcriptRows.map((row) => (
              <div
                key={row.title}
                className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${row.accent}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium">{row.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{row.meta}</p>
                  </div>
                </div>
                <span className="w-fit rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                  {row.status}
                </span>
              </div>
            ))}
          </div>

          <div className="grid gap-4 border-t border-[var(--border)] px-5 py-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">Internal attendee access</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Meeting participants get access only when they match workspace
                membership.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Share controls</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Share transcripts with managed links after processing finishes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
