import { notFound } from "next/navigation";

import { LocalDateTime } from "@/components/local-date-time";
import { ProductLogo } from "@/components/product-logo";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { requireCurrentUser } from "@/lib/auth-guards";
import { getSharedTranscriptByToken } from "@/lib/share-links";

export const dynamic = "force-dynamic";

export default async function SharedTranscriptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await requireCurrentUser();

  const { token } = await params;
  const sharedTranscript = await getSharedTranscriptByToken(token);

  if (!sharedTranscript) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-4xl min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <ProductLogo />
          <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            Read only
          </span>
        </header>
        <p className="mt-8 text-sm font-medium text-primary">Shared transcript</p>
        <h1 className="mt-2 break-words text-3xl font-semibold">
          {sharedTranscript.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {sharedTranscript.startedAt ? (
            <LocalDateTime value={sharedTranscript.startedAt} />
          ) : null}
          {sharedTranscript.startedAt ? <span aria-hidden="true">·</span> : null}
          <span>Shared by {sharedTranscript.sharedBy}</span>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          You can read this transcript because it was shared with your Tape account.
        </p>
        <div className="mt-8">
          <TranscriptViewer segments={sharedTranscript.segments} />
        </div>
      </section>
    </main>
  );
}
