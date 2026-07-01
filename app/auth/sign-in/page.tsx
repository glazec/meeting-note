import { SignInForm } from "./sign-in-form";

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
    <main className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,var(--surface)_100%)] px-4 py-10 text-foreground sm:px-6 sm:py-14">
      <section className="mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-primary">
            Meeting Transcript
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
            Sign in to your workspace.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Use your company Google account to access internal transcripts.
          </p>
          <SignInForm callbackUrl={signInCallbackUrl} />
        </div>
        <div className="rounded-lg border bg-card p-5 text-sm shadow-sm">
          <p className="font-semibold">Access model</p>
          <div className="mt-4 grid gap-3 text-muted-foreground">
            <p>Workspace members can review and add meetings.</p>
            <p>External readers only see transcripts explicitly shared with them.</p>
            <p>Legacy shared links still require sign in before transcript data loads.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
